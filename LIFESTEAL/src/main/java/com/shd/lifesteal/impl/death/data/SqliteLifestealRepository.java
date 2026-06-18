package com.shd.lifesteal.impl.data;

import com.shd.lifesteal.ShdLifestealMod;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public final class SqliteLifestealRepository implements LifestealRepository {
    private final Path databasePath;
    private final String jdbcUrl;

    public SqliteLifestealRepository(Path databasePath) {
        this.databasePath = databasePath;
        this.jdbcUrl = "jdbc:sqlite:" + databasePath.toAbsolutePath();
    }

    public void initialize() {
        try {
            Files.createDirectories(databasePath.getParent());
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to create lifesteal data directory", exception);
        }

        try (Connection connection = connect();
             Statement statement = connection.createStatement()) {
            statement.executeUpdate("""
                    CREATE TABLE IF NOT EXISTS players (
                        player_id TEXT PRIMARY KEY NOT NULL,
                        hearts INTEGER NOT NULL,
                        eliminated INTEGER NOT NULL DEFAULT 0,
                        kills INTEGER NOT NULL DEFAULT 0,
                        deaths INTEGER NOT NULL DEFAULT 0,
                        revivals INTEGER NOT NULL DEFAULT 0,
                        heart_gains INTEGER NOT NULL DEFAULT 0,
                        heart_losses INTEGER NOT NULL DEFAULT 0,
                        mace_kills INTEGER NOT NULL DEFAULT 0,
                        unique_kills INTEGER NOT NULL DEFAULT 0,
                        current_killstreak INTEGER NOT NULL DEFAULT 0,
                        highest_killstreak INTEGER NOT NULL DEFAULT 0,
                        mace_1_kills INTEGER NOT NULL DEFAULT 0,
                        mace_2_kills INTEGER NOT NULL DEFAULT 0,
                        playtime_seconds INTEGER NOT NULL DEFAULT 0,
                        updated_at INTEGER NOT NULL
                    )
                    """);
            statement.executeUpdate("""
                    CREATE TABLE IF NOT EXISTS unique_kills (
                        killer_id TEXT NOT NULL,
                        victim_id TEXT NOT NULL,
                        first_kill_at INTEGER NOT NULL,
                        PRIMARY KEY (killer_id, victim_id)
                    )
                    """);
            ensureColumn(connection, "heart_gains", "INTEGER NOT NULL DEFAULT 0");
            ensureColumn(connection, "heart_losses", "INTEGER NOT NULL DEFAULT 0");
            ensureColumn(connection, "mace_kills", "INTEGER NOT NULL DEFAULT 0");
            ensureColumn(connection, "unique_kills", "INTEGER NOT NULL DEFAULT 0");
            ensureColumn(connection, "current_killstreak", "INTEGER NOT NULL DEFAULT 0");
            ensureColumn(connection, "highest_killstreak", "INTEGER NOT NULL DEFAULT 0");
            ensureColumn(connection, "mace_1_kills", "INTEGER NOT NULL DEFAULT 0");
            ensureColumn(connection, "mace_2_kills", "INTEGER NOT NULL DEFAULT 0");
            ensureColumn(connection, "playtime_seconds", "INTEGER NOT NULL DEFAULT 0");
            ShdLifestealMod.LOGGER.info("Lifesteal SQLite store ready at {}", databasePath.toAbsolutePath());
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to initialize lifesteal SQLite store", exception);
        }
    }

    @Override
    public Optional<PlayerData> findPlayer(UUID playerId) {
        String sql = """
                SELECT player_id, hearts, eliminated, kills, deaths, revivals, heart_gains, heart_losses, mace_kills,
                       unique_kills, current_killstreak, highest_killstreak, mace_1_kills, mace_2_kills, playtime_seconds
                FROM players
                WHERE player_id = ?
                """;

        try (Connection connection = connect();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, playerId.toString());

            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) {
                    return Optional.empty();
                }

                return Optional.of(readPlayer(result));
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load player lifesteal data for " + playerId, exception);
        }
    }

    @Override
    public List<PlayerData> findPlayers() {
        String sql = """
                SELECT player_id, hearts, eliminated, kills, deaths, revivals, heart_gains, heart_losses, mace_kills,
                       unique_kills, current_killstreak, highest_killstreak, mace_1_kills, mace_2_kills, playtime_seconds
                FROM players
                """;

        try (Connection connection = connect();
             PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet result = statement.executeQuery()) {
            List<PlayerData> players = new ArrayList<>();
            while (result.next()) {
                players.add(readPlayer(result));
            }
            return players;
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load lifesteal player data", exception);
        }
    }

    @Override
    public PlayerData savePlayer(PlayerData playerData) {
        String sql = """
                INSERT INTO players (
                    player_id, hearts, eliminated, kills, deaths, revivals, heart_gains, heart_losses, mace_kills,
                    unique_kills, current_killstreak, highest_killstreak, mace_1_kills, mace_2_kills, playtime_seconds, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(player_id) DO UPDATE SET
                    hearts = excluded.hearts,
                    eliminated = excluded.eliminated,
                    kills = excluded.kills,
                    deaths = excluded.deaths,
                    revivals = excluded.revivals,
                    heart_gains = excluded.heart_gains,
                    heart_losses = excluded.heart_losses,
                    mace_kills = excluded.mace_kills,
                    unique_kills = excluded.unique_kills,
                    current_killstreak = excluded.current_killstreak,
                    highest_killstreak = excluded.highest_killstreak,
                    mace_1_kills = excluded.mace_1_kills,
                    mace_2_kills = excluded.mace_2_kills,
                    playtime_seconds = excluded.playtime_seconds,
                    updated_at = excluded.updated_at
                """;

        try (Connection connection = connect();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, playerData.playerId().toString());
            statement.setInt(2, playerData.hearts());
            statement.setInt(3, playerData.eliminated() ? 1 : 0);
            statement.setInt(4, playerData.kills());
            statement.setInt(5, playerData.deaths());
            statement.setInt(6, playerData.revivals());
            statement.setInt(7, playerData.heartGains());
            statement.setInt(8, playerData.heartLosses());
            statement.setInt(9, playerData.maceKills());
            statement.setInt(10, playerData.uniqueKills());
            statement.setInt(11, playerData.currentKillstreak());
            statement.setInt(12, playerData.highestKillstreak());
            statement.setInt(13, playerData.maceOneKills());
            statement.setInt(14, playerData.maceTwoKills());
            statement.setLong(15, playerData.playtimeSeconds());
            statement.setLong(16, System.currentTimeMillis());
            statement.executeUpdate();
            return playerData;
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to save player lifesteal data for " + playerData.playerId(), exception);
        }
    }

    @Override
    public boolean recordUniqueKill(UUID killerId, UUID victimId) {
        String sql = """
                INSERT OR IGNORE INTO unique_kills (killer_id, victim_id, first_kill_at)
                VALUES (?, ?, ?)
                """;

        try (Connection connection = connect();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, killerId.toString());
            statement.setString(2, victimId.toString());
            statement.setLong(3, System.currentTimeMillis());
            return statement.executeUpdate() > 0;
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to record unique kill for " + killerId + " -> " + victimId, exception);
        }
    }

    @Override
    public void clearSeasonState() {
        try (Connection connection = connect();
             Statement statement = connection.createStatement()) {
            statement.executeUpdate("DELETE FROM players");
            statement.executeUpdate("DELETE FROM unique_kills");
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to clear lifesteal season state", exception);
        }
    }

    private Connection connect() throws SQLException {
        return DriverManager.getConnection(jdbcUrl);
    }

    private void ensureColumn(Connection connection, String columnName, String definition) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA table_info(players)")) {
            while (result.next()) {
                if (columnName.equals(result.getString("name"))) {
                    return;
                }
            }
        }

        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate("ALTER TABLE players ADD COLUMN " + columnName + " " + definition);
        }
    }

    private PlayerData readPlayer(ResultSet result) throws SQLException {
        return new PlayerData(
                UUID.fromString(result.getString("player_id")),
                result.getInt("hearts"),
                result.getInt("eliminated") != 0,
                result.getInt("kills"),
                result.getInt("deaths"),
                result.getInt("revivals"),
                result.getInt("heart_gains"),
                result.getInt("heart_losses"),
                result.getInt("mace_kills"),
                result.getInt("unique_kills"),
                result.getInt("current_killstreak"),
                result.getInt("highest_killstreak"),
                result.getInt("mace_1_kills"),
                result.getInt("mace_2_kills"),
                result.getLong("playtime_seconds")
        );
    }
}
