package com.shd.lifesteal.impl;

import com.shd.lifesteal.api.LifestealApi;
import com.shd.lifesteal.impl.anticheat.AntiCheatCheckRunner;
import com.shd.lifesteal.impl.anticheat.AntiCheatIdentityStore;
import com.shd.lifesteal.impl.anticheat.AntiCheatPersistence;
import com.shd.lifesteal.impl.anticheat.AntiCheatService;
import com.shd.lifesteal.impl.anticheat.AntiCheatSettings;
import com.shd.lifesteal.impl.audit.LifestealAuditLog;
import com.shd.lifesteal.impl.combat.CombatEventHandler;
import com.shd.lifesteal.impl.combat.CombatLogoutHandler;
import com.shd.lifesteal.impl.combat.CombatTagService;
import com.shd.lifesteal.impl.command.LifestealCommandRegistrar;
import com.shd.lifesteal.impl.config.LifestealConfig;
import com.shd.lifesteal.impl.config.LifestealRuleSettings;
import com.shd.lifesteal.impl.connection.JoinLeaveMessageHandler;
import com.shd.lifesteal.impl.data.SqliteLifestealRepository;
import com.shd.lifesteal.impl.death.DeathResolutionService;
import com.shd.lifesteal.impl.death.PlayerDeathHandler;
import com.shd.lifesteal.impl.discord.DiscordRoleSyncService;
import com.shd.lifesteal.impl.dragon.DragonEggBeaconEffectHandler;
import com.shd.lifesteal.impl.dragon.DragonEggGlowHandler;
import com.shd.lifesteal.impl.dragon.DragonEggTracker;
import com.shd.lifesteal.impl.elimination.EliminationService;
import com.shd.lifesteal.impl.event.EventTimerService;
import com.shd.lifesteal.impl.grace.GraceProtectionHandler;
import com.shd.lifesteal.impl.grace.GracePeriodService;
import com.shd.lifesteal.impl.grace.GraceWarningPublisher;
import com.shd.lifesteal.impl.heart.HeartService;
import com.shd.lifesteal.impl.heart.PlayerHeartApplier;
import com.shd.lifesteal.impl.item.ModItems;
import com.shd.lifesteal.impl.player.WhitelistPlayerResolver;
import com.shd.lifesteal.impl.player.PlayerPlaytimeTracker;
import com.shd.lifesteal.impl.restriction.DisabledFeatureHandler;
import com.shd.lifesteal.impl.restriction.ElytraCombatCooldownService;
import com.shd.lifesteal.impl.restriction.MaceLimitRules;
import com.shd.lifesteal.impl.storage.RestrictedItemPolicy;
import com.shd.lifesteal.impl.storage.RestrictedStorageHandler;
import com.shd.lifesteal.impl.ui.GameplayRoleUiPublisher;
import com.shd.lifesteal.impl.ui.LifestealActionbar;
import com.shd.lifesteal.impl.ui.LifestealBossbarService;
import com.shd.lifesteal.impl.ui.LifestealSoundService;
import com.shd.lifesteal.impl.ui.LifestealTabListService;
import com.shd.lifesteal.impl.ui.LifestealUiSettings;
import com.shd.lifesteal.impl.ui.UiBridgeManager;
import java.nio.file.Path;
import net.fabricmc.loader.api.FabricLoader;

public final class LifestealRuntime {
    private final LifestealConfig config = LifestealConfig.defaults();
    private final Path configDirectory = FabricLoader.getInstance()
            .getGameDir()
            .resolve("config")
            .resolve("shd-lifesteal");
    private final Path databasePath = FabricLoader.getInstance()
            .getGameDir()
            .resolve("config")
            .resolve("shd-lifesteal")
            .resolve("lifesteal.sqlite");
    private final LifestealUiSettings uiSettings = new LifestealUiSettings(configDirectory.resolve("ui.properties"));
    private final LifestealRuleSettings ruleSettings = new LifestealRuleSettings(configDirectory.resolve("rules.properties"));
    private final AntiCheatSettings antiCheatSettings = new AntiCheatSettings(configDirectory.resolve("anticheat.properties"));
    private final LifestealSoundService soundService = new LifestealSoundService(uiSettings);
    private final LifestealAuditLog auditLog = new LifestealAuditLog(configDirectory.resolve("lifesteal-audit.log"));
    private final AntiCheatPersistence antiCheatPersistence = new AntiCheatPersistence(
            configDirectory.resolve("anticheat-history.jsonl"),
            configDirectory.resolve("anticheat-reviews.jsonl")
    );
    private final AntiCheatIdentityStore antiCheatIdentityStore = new AntiCheatIdentityStore(configDirectory.resolve("anticheat-accounts.json"));
    private final AntiCheatService antiCheatService = new AntiCheatService(antiCheatSettings, auditLog, antiCheatPersistence);
    private final AntiCheatCheckRunner antiCheatCheckRunner = new AntiCheatCheckRunner(antiCheatService, antiCheatSettings, antiCheatIdentityStore);
    private final SqliteLifestealRepository repository = new SqliteLifestealRepository(databasePath);
    private final UiBridgeManager uiBridgeManager = new UiBridgeManager();
    private final GracePeriodService gracePeriodService = new GracePeriodService(config, uiBridgeManager);
    private final EventTimerService eventTimerService = new EventTimerService(configDirectory.resolve("event-timer.properties"));
    private final GraceProtectionHandler graceProtectionHandler = new GraceProtectionHandler(gracePeriodService);
    private final EliminationService eliminationService = new EliminationService(repository);
    private final HeartService heartService = new HeartService(config, repository, eliminationService, gracePeriodService, uiBridgeManager);
    private final PlayerHeartApplier playerHeartApplier = new PlayerHeartApplier(heartService);
    private final CombatTagService combatTagService = new CombatTagService(config, uiBridgeManager);
    private final ElytraCombatCooldownService elytraCombatCooldownService = new ElytraCombatCooldownService();
    private final CombatEventHandler combatEventHandler = new CombatEventHandler(combatTagService, gracePeriodService, ruleSettings, elytraCombatCooldownService, uiBridgeManager);
    private final RestrictedItemPolicy restrictedItemPolicy = new RestrictedItemPolicy();
    private final ModItems modItems = new ModItems(heartService, playerHeartApplier);
    private final DragonEggTracker dragonEggTracker = new DragonEggTracker(restrictedItemPolicy);
    private final WhitelistPlayerResolver playerResolver = new WhitelistPlayerResolver();
    private final PlayerPlaytimeTracker playerPlaytimeTracker = new PlayerPlaytimeTracker(heartService);
    private final LifestealCommandRegistrar commandRegistrar = new LifestealCommandRegistrar(
            heartService,
            playerHeartApplier,
            modItems,
            playerResolver,
            combatTagService,
            gracePeriodService,
            eventTimerService,
            ruleSettings,
            uiSettings,
            soundService,
            auditLog,
            antiCheatService
    );
    private final PlayerConnectionHooks playerConnectionHooks = new PlayerConnectionHooks(heartService, playerHeartApplier);
    private final JoinLeaveMessageHandler joinLeaveMessageHandler = new JoinLeaveMessageHandler(uiBridgeManager);
    private final DeathResolutionService deathResolutionService = new DeathResolutionService(
            heartService,
            playerHeartApplier,
            combatTagService,
            modItems,
            uiBridgeManager,
            soundService
    );
    private final PlayerDeathHandler playerDeathHandler = new PlayerDeathHandler(playerHeartApplier, deathResolutionService, soundService);
    private final CombatLogoutHandler combatLogoutHandler = new CombatLogoutHandler(combatTagService, deathResolutionService, uiBridgeManager);
    private final DisabledFeatureHandler disabledFeatureHandler = new DisabledFeatureHandler(combatTagService, ruleSettings, elytraCombatCooldownService, uiBridgeManager);
    private final RestrictedStorageHandler restrictedStorageHandler = new RestrictedStorageHandler(modItems);
    private final DragonEggGlowHandler dragonEggGlowHandler = new DragonEggGlowHandler(config);
    private final DiscordRoleSyncService discordRoleSyncService = new DiscordRoleSyncService(config, heartService, dragonEggGlowHandler);
    private final DragonEggBeaconEffectHandler dragonEggBeaconEffectHandler = new DragonEggBeaconEffectHandler(
            uiBridgeManager,
            configDirectory.resolve("dragon-egg-location.properties")
    );
    private final GameplayRoleUiPublisher gameplayRoleUiPublisher = new GameplayRoleUiPublisher(heartService, uiBridgeManager);
    private final GraceWarningPublisher graceWarningPublisher = new GraceWarningPublisher(gracePeriodService, uiBridgeManager);
    private final LifestealActionbar lifestealActionbar = new LifestealActionbar(gracePeriodService, combatTagService, elytraCombatCooldownService, eventTimerService, uiSettings);
    private final LifestealTabListService lifestealTabListService = new LifestealTabListService(heartService, gracePeriodService, eventTimerService, dragonEggBeaconEffectHandler, uiSettings);
    private final LifestealBossbarService lifestealBossbarService = new LifestealBossbarService(gracePeriodService, eventTimerService, dragonEggBeaconEffectHandler, uiSettings);

    public void initialize() {
        uiSettings.load();
        ruleSettings.load();
        antiCheatSettings.load();
        antiCheatService.load();
        antiCheatIdentityStore.load();
        eventTimerService.load();
        repository.initialize();
        uiBridgeManager.loadEntrypoints();
        MaceLimitRules.initialize(configDirectory);
        modItems.register();
        commandRegistrar.register();
        playerConnectionHooks.register();
        joinLeaveMessageHandler.register();
        playerDeathHandler.register();
        playerPlaytimeTracker.register();
        combatEventHandler.register();
        combatLogoutHandler.register();
        graceProtectionHandler.register();
        disabledFeatureHandler.register();
        restrictedStorageHandler.register();
        dragonEggGlowHandler.register();
        dragonEggBeaconEffectHandler.register();
        gameplayRoleUiPublisher.register();
        graceWarningPublisher.register();
        lifestealActionbar.register();
        lifestealTabListService.register();
        lifestealBossbarService.register();
        antiCheatCheckRunner.register();
        discordRoleSyncService.register();
        LifestealApi.setService(heartService);
    }

    public CombatTagService combatTagService() {
        return combatTagService;
    }

    public RestrictedItemPolicy restrictedItemPolicy() {
        return restrictedItemPolicy;
    }

    public DragonEggTracker dragonEggTracker() {
        return dragonEggTracker;
    }

    public AntiCheatService antiCheatService() {
        return antiCheatService;
    }
}
