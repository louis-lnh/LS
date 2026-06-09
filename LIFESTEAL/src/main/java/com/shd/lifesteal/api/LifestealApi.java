package com.shd.lifesteal.api;

import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

public final class LifestealApi {
    private static final AtomicReference<LifestealService> SERVICE = new AtomicReference<>();

    private LifestealApi() {
    }

    public static Optional<LifestealService> get() {
        return Optional.ofNullable(SERVICE.get());
    }

    public static void setService(LifestealService service) {
        if (!SERVICE.compareAndSet(null, Objects.requireNonNull(service, "service"))) {
            throw new IllegalStateException("Lifesteal service has already been registered");
        }
    }
}
