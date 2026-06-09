package com.shd.lifesteal.api;

import java.time.Duration;

public record GracePeriodSnapshot(boolean active, boolean paused, Duration remaining) {
}
