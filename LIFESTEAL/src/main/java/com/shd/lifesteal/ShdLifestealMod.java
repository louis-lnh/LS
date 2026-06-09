package com.shd.lifesteal;

import com.shd.lifesteal.impl.LifestealRuntime;
import net.fabricmc.api.ModInitializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class ShdLifestealMod implements ModInitializer {
    public static final String MOD_ID = "shd-lifesteal";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    private final LifestealRuntime runtime = new LifestealRuntime();

    @Override
    public void onInitialize() {
        runtime.initialize();
        LOGGER.info("SHD Lifesteal initialized");
    }
}
