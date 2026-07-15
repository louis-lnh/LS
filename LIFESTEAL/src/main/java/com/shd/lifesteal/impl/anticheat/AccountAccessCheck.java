package com.shd.lifesteal.impl.anticheat;

import com.shd.lifesteal.ShdLifestealMod;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.network.packet.BrandCustomPayload;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.PlayerConfigEntry;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.util.Identifier;

public final class AccountAccessCheck implements AntiCheatCheck {
    private static final long BRAND_CHECK_PENDING_START = Long.MAX_VALUE;
    private static final int MAX_BRAND_LENGTH = 80;

    private final AntiCheatService antiCheatService;
    private final AntiCheatSettings settings;
    private final AntiCheatIdentityStore identityStore;
    private final Map<UUID, Long> pendingBrandChecks = new HashMap<>();
    private final Map<UUID, String> observedBrands = new HashMap<>();
    private final Map<UUID, Long> pendingModReportChecks = new HashMap<>();
    private final Set<UUID> observedModReports = new LinkedHashSet<>();
    private boolean brandReceiverRegistered;
    private boolean modReportReceiverRegistered;

    public AccountAccessCheck(AntiCheatService antiCheatService, AntiCheatSettings settings, AntiCheatIdentityStore identityStore) {
        this.antiCheatService = antiCheatService;
        this.settings = settings;
        this.identityStore = identityStore;
    }

    @Override
    public String id() {
        return "account_access";
    }

    @Override
    public void register() {
        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> onJoin(server, handler.getPlayer()));
        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
            UUID playerId = handler.getPlayer().getUuid();
            pendingBrandChecks.remove(playerId);
            observedBrands.remove(playerId);
            pendingModReportChecks.remove(playerId);
            observedModReports.remove(playerId);
        });

        try {
            brandReceiverRegistered = ServerPlayNetworking.registerGlobalReceiver(BrandCustomPayload.ID, (payload, context) -> onBrand(context.server(), context.player(), payload.brand()));
        } catch (IllegalArgumentException exception) {
            brandReceiverRegistered = false;
            ShdLifestealMod.LOGGER.warn("Unable to register anti-cheat client brand receiver", exception);
        }

        try {
            PayloadTypeRegistry.playC2S().register(ClientModReportPayload.ID, ClientModReportPayload.CODEC);
            modReportReceiverRegistered = ServerPlayNetworking.registerGlobalReceiver(ClientModReportPayload.ID, (payload, context) -> onModReport(context.server(), context.player(), payload));
        } catch (IllegalArgumentException exception) {
            modReportReceiverRegistered = false;
            ShdLifestealMod.LOGGER.warn("Unable to register anti-cheat client mod report receiver", exception);
        }
    }

    @Override
    public void tick(AntiCheatCheckContext context) {
        if (!settings.enabled() || !settings.clientChecksEnabled()) {
            return;
        }

        if (settings.clientRequireBrand() && brandReceiverRegistered) {
            checkPendingBrand(context);
        }
        if (settings.clientRequireModReport() && modReportReceiverRegistered) {
            checkPendingModReport(context);
        }
    }

    private void checkPendingBrand(AntiCheatCheckContext context) {
        Long checkTick = pendingBrandChecks.get(context.player().getUuid());
        if (checkTick == null) {
            return;
        }
        if (checkTick == BRAND_CHECK_PENDING_START) {
            pendingBrandChecks.put(context.player().getUuid(), context.tick() + settings.clientBrandGraceTicks());
            return;
        }
        if (context.tick() < checkTick) {
            return;
        }
        pendingBrandChecks.remove(context.player().getUuid());
        if (observedBrands.containsKey(context.player().getUuid())) {
            return;
        }

        alert(context.server(), context.player(), AntiCheatCategory.CLIENT_INTEGRITY, AntiCheatSeverity.WARNING, "client_missing_brand", "Missing client integrity metadata detected", "brandPayload=missing graceTicks=%d".formatted(
                settings.clientBrandGraceTicks()
        ));
    }

    private void checkPendingModReport(AntiCheatCheckContext context) {
        Long checkTick = pendingModReportChecks.get(context.player().getUuid());
        if (checkTick == null) {
            return;
        }
        if (checkTick == BRAND_CHECK_PENDING_START) {
            pendingModReportChecks.put(context.player().getUuid(), context.tick() + settings.clientBrandGraceTicks());
            return;
        }
        if (context.tick() < checkTick) {
            return;
        }
        pendingModReportChecks.remove(context.player().getUuid());
        if (observedModReports.contains(context.player().getUuid())) {
            return;
        }

        alert(context.server(), context.player(), AntiCheatCategory.CLIENT_INTEGRITY, AntiCheatSeverity.WARNING, "client_missing_mod_report", "Missing client mod report detected", "modReport=missing graceTicks=%d".formatted(
                settings.clientBrandGraceTicks()
        ));
    }

    @Override
    public void endServerTick(AntiCheatServerTickContext context) {
        pendingBrandChecks.keySet().removeIf(playerId -> !context.onlinePlayers().contains(playerId));
        observedBrands.keySet().removeIf(playerId -> !context.onlinePlayers().contains(playerId));
        pendingModReportChecks.keySet().removeIf(playerId -> !context.onlinePlayers().contains(playerId));
        observedModReports.removeIf(playerId -> !context.onlinePlayers().contains(playerId));
    }

    private void onJoin(MinecraftServer server, ServerPlayerEntity player) {
        if (!settings.enabled()) {
            return;
        }

        boolean staffOperator = server.getPlayerManager().isOperator(new PlayerConfigEntry(player.getGameProfile()));
        if (settings.accountChecksEnabled()) {
            AntiCheatIdentityStore.LoginAssessment assessment = identityStore.recordLogin(player, staffOperator);
            checkAccountAccess(server, player, assessment);
        }

        if (settings.clientChecksEnabled()) {
            checkClientChannels(server, player);
            if (settings.clientRequireBrand() && brandReceiverRegistered) {
                pendingBrandChecks.put(player.getUuid(), BRAND_CHECK_PENDING_START);
            }
            if (settings.clientRequireModReport() && modReportReceiverRegistered && !observedModReports.contains(player.getUuid())) {
                pendingModReportChecks.put(player.getUuid(), BRAND_CHECK_PENDING_START);
            }
        }
    }

    private void onBrand(MinecraftServer server, ServerPlayerEntity player, String brand) {
        if (!settings.enabled() || !settings.clientChecksEnabled()) {
            return;
        }

        String rawBrand = brand == null ? "" : brand.trim();
        String normalizedBrand = normalize(rawBrand);
        observedBrands.put(player.getUuid(), normalizedBrand);
        pendingBrandChecks.remove(player.getUuid());
        AntiCheatIdentityStore.BrandAssessment assessment = identityStore.recordBrand(player, normalizedBrand);

        if (rawBrand.isBlank()) {
            alert(server, player, AntiCheatCategory.CLIENT_INTEGRITY, AntiCheatSeverity.WARNING, "client_blank_brand", "Blank client integrity metadata detected", "brandPayload=blank");
            return;
        }

        if (rawBrand.length() > MAX_BRAND_LENGTH) {
            alert(server, player, AntiCheatCategory.CLIENT_INTEGRITY, AntiCheatSeverity.WARNING, "client_long_brand", "Unusual client integrity metadata detected", "brandLength=%d max=%d normalizedBrand=%s".formatted(
                    rawBrand.length(),
                    MAX_BRAND_LENGTH,
                    normalizedBrand
            ));
        }

        if (settings.clientTrackBrandChanges() && assessment.changed()) {
            alert(server, player, AntiCheatCategory.CLIENT_INTEGRITY, AntiCheatSeverity.WARNING, "client_brand_changed", "Client integrity metadata changed", "previousBrand=%s currentBrand=%s".formatted(
                    assessment.previousBrand(),
                    assessment.currentBrand()
            ));
        }

        if (settings.clientBlockedBrands().contains(normalizedBrand)) {
            alert(server, player, AntiCheatCategory.CLIENT_INTEGRITY, AntiCheatSeverity.HIGH, "client_blocked_brand", "Blocked client brand detected", "brand=%s blockedBrands=%s".formatted(
                    normalizedBrand,
                    settings.clientBlockedBrands()
            ));
        }

        if (!settings.clientAllowedBrands().isEmpty() && !settings.clientAllowedBrands().contains(normalizedBrand)) {
            alert(server, player, AntiCheatCategory.CLIENT_INTEGRITY, AntiCheatSeverity.HIGH, "client_unapproved_brand", "Unapproved client brand detected", "brand=%s allowedBrands=%s".formatted(
                    normalizedBrand,
                    settings.clientAllowedBrands()
            ));
        }
    }

    private void onModReport(MinecraftServer server, ServerPlayerEntity player, ClientModReportPayload payload) {
        if (!settings.enabled() || !settings.clientChecksEnabled()) {
            return;
        }

        List<String> modIds = new ArrayList<>();
        if (payload.mods() != null) {
            for (ClientModReportPayload.ModEntry entry : payload.mods()) {
                String id = normalizeModId(entry.id());
                if (!id.isBlank() && !modIds.contains(id)) {
                    modIds.add(id);
                }
            }
        }
        boolean firstReportThisSession = observedModReports.add(player.getUuid());
        pendingModReportChecks.remove(player.getUuid());

        AntiCheatIdentityStore.ModReportAssessment assessment = identityStore.recordModReport(player, modIds);
        Set<String> currentMods = new LinkedHashSet<>(assessment.currentMods());
        boolean shouldAlertReportContents = firstReportThisSession || assessment.changed();

        if (shouldAlertReportContents && payload.protocolVersion() != 1) {
            alert(server, player, AntiCheatCategory.CLIENT_INTEGRITY, AntiCheatSeverity.WARNING, "client_mod_report_protocol", "Unexpected client mod report protocol", "protocol=%d mods=%d".formatted(
                    payload.protocolVersion(),
                    currentMods.size()
            ));
        }

        if (currentMods.isEmpty()) {
            if (shouldAlertReportContents) {
                alert(server, player, AntiCheatCategory.CLIENT_INTEGRITY, AntiCheatSeverity.WARNING, "client_empty_mod_report", "Empty client mod report detected", "protocol=%d".formatted(payload.protocolVersion()));
            }
            return;
        }

        if (assessment.changed()) {
            alert(server, player, AntiCheatCategory.CLIENT_INTEGRITY, AntiCheatSeverity.INFO, "client_mod_report_changed", "Client mod report changed", "previousCount=%d currentCount=%d added=%s removed=%s".formatted(
                    assessment.previousMods().size(),
                    assessment.currentMods().size(),
                    limitStrings(difference(currentMods, new LinkedHashSet<>(assessment.previousMods()))),
                    limitStrings(difference(new LinkedHashSet<>(assessment.previousMods()), currentMods))
            ));
        }

        Set<String> suspicious = new LinkedHashSet<>(currentMods);
        suspicious.retainAll(settings.clientSuspiciousModIds());
        if (shouldAlertReportContents && !suspicious.isEmpty()) {
            alert(server, player, AntiCheatCategory.CLIENT_INTEGRITY, AntiCheatSeverity.WARNING, "client_suspicious_mods", "Suspicious client mods reported", "mods=%s total=%d".formatted(
                    limitStrings(suspicious),
                    currentMods.size()
            ));
        }

        Set<String> blocked = new LinkedHashSet<>(currentMods);
        blocked.retainAll(settings.clientBlockedModIds());
        if (shouldAlertReportContents && !blocked.isEmpty()) {
            alert(server, player, AntiCheatCategory.CLIENT_INTEGRITY, AntiCheatSeverity.HIGH, "client_blocked_mods", "Blocked client mods reported", "mods=%s total=%d".formatted(
                    limitStrings(blocked),
                    currentMods.size()
            ));
        }
    }

    private void checkAccountAccess(MinecraftServer server, ServerPlayerEntity player, AntiCheatIdentityStore.LoginAssessment assessment) {
        if (assessment.staffOperator() && settings.accountAlertStaffLogin()) {
            alert(server, player, AntiCheatCategory.STAFF_ACTION, AntiCheatSeverity.INFO, "staff_account_login", "Staff account login observed", "operator=true ipHash=%s knownIpAccounts=%d".formatted(
                    assessment.ipHash(),
                    assessment.uuidsForIpHash().size()
            ));
        }

        if (assessment.nameChanged() && settings.accountAlertNameChanges()) {
            alert(server, player, AntiCheatCategory.ACCOUNT_ACCESS, AntiCheatSeverity.INFO, "account_name_changed", "Minecraft account name changed", "previousName=%s currentName=%s".formatted(
                    assessment.previousName(),
                    player.getName().getString()
            ));
        }

        if (!assessment.otherUuidsForName().isEmpty() && settings.accountAlertNameReuse()) {
            alert(server, player, AntiCheatCategory.ACCOUNT_ACCESS, AntiCheatSeverity.HIGH, "account_name_uuid_conflict", "Minecraft name has been seen on another UUID", "name=%s otherUuids=%s".formatted(
                    player.getName().getString(),
                    limitUuids(assessment.otherUuidsForName())
            ));
        }

        if (assessment.uuidsForIpHash().size() > settings.accountMaxAccountsPerIpHash() && settings.accountAlertIpClusters()) {
            alert(server, player, AntiCheatCategory.ACCOUNT_ACCESS, AntiCheatSeverity.WARNING, "account_ip_cluster", "Multiple accounts seen from the same network", "ipHash=%s uuidCount=%d max=%d uuids=%s".formatted(
                    assessment.ipHash(),
                    assessment.uuidsForIpHash().size(),
                    settings.accountMaxAccountsPerIpHash(),
                    limitUuids(assessment.uuidsForIpHash())
            ));
        }
    }

    private void checkClientChannels(MinecraftServer server, ServerPlayerEntity player) {
        Set<String> channels = observedChannels(player);
        Set<String> missingRequired = new LinkedHashSet<>(settings.clientRequiredChannels());
        missingRequired.removeAll(channels);
        if (!missingRequired.isEmpty()) {
            alert(server, player, AntiCheatCategory.CLIENT_INTEGRITY, AntiCheatSeverity.HIGH, "client_missing_required_channel", "Required client channel missing", "missing=%s observed=%s".formatted(
                    missingRequired,
                    limitStrings(channels)
            ));
        }

        Set<String> disallowed = new LinkedHashSet<>(channels);
        disallowed.retainAll(settings.clientDisallowedChannels());
        if (!disallowed.isEmpty()) {
            alert(server, player, AntiCheatCategory.CLIENT_INTEGRITY, AntiCheatSeverity.HIGH, "client_disallowed_channel", "Disallowed client channel declared", "disallowed=%s observed=%s".formatted(
                    disallowed,
                    limitStrings(channels)
            ));
        }
    }

    private Set<String> observedChannels(ServerPlayerEntity player) {
        Set<String> channels = new LinkedHashSet<>();
        for (Identifier identifier : ServerPlayNetworking.getReceived(player)) {
            channels.add(identifier.toString().toLowerCase(Locale.ROOT));
        }
        for (Identifier identifier : ServerPlayNetworking.getSendable(player)) {
            channels.add(identifier.toString().toLowerCase(Locale.ROOT));
        }
        return channels;
    }

    private void alert(MinecraftServer server, ServerPlayerEntity player, AntiCheatCategory category, AntiCheatSeverity severity, String reasonCode, String publicReason, String detail) {
        antiCheatService.handle(server, player, new AntiCheatDetection(
                category,
                severity,
                reasonCode,
                publicReason,
                "check=%s player=%s uuid=%s %s".formatted(
                        id(),
                        player.getName().getString(),
                        player.getUuidAsString(),
                        detail
                ),
                AntiCheatAction.AUDIT_ONLY
        ));
    }

    private static String normalize(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        return normalized.length() <= MAX_BRAND_LENGTH ? normalized : normalized.substring(0, MAX_BRAND_LENGTH);
    }

    private static String normalizeModId(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        return normalized.length() <= 96 ? normalized : normalized.substring(0, 96);
    }

    private static Set<String> difference(Set<String> left, Set<String> right) {
        Set<String> values = new LinkedHashSet<>(left);
        values.removeAll(right);
        return values;
    }

    private static List<String> limitStrings(Set<String> values) {
        return values.stream().sorted().limit(12).toList();
    }

    private static List<String> limitUuids(Set<UUID> values) {
        List<String> ids = new ArrayList<>();
        for (UUID value : values) {
            ids.add(value.toString());
            if (ids.size() >= 8) {
                break;
            }
        }
        return ids;
    }
}
