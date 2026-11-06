package com.jarvis.wear.ai

import java.util.Calendar

object PersonalityEngine {

    fun getTimeBasedGreeting(hourOfDay: Int = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)): String {
        return when (hourOfDay) {
            in 5..11 -> "Good morning, sir"
            in 12..17 -> "Good afternoon, sir"
            else -> "Good evening, sir"
        }
    }

    fun buildSystemPrompt(
        personalityMode: String,
        customAddition: String = ""
    ): String {
        val basePersona = when (personalityMode.lowercase()) {
            "tactical_hud" ->
                "You are J.A.R.V.I.S. operating in Tactical HUD mode on a Samsung Galaxy Watch 4 (40mm circular display). Deliver high-density, ultra-concise telemetry and tactical answers in 1 to 2 short sentences. Address the user as 'sir'."
            "formal_butler" ->
                "You are J.A.R.V.I.S., an impeccably polite, refined British executive AI assistant on a circular Wear OS smartwatch. Respond with composure, precision, and brevity (under 40 words). Address the user as 'sir'."
            else -> // "stark_classic"
                "You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), a dry-witted, hyper-competent British executive AI assistant running natively on a Samsung Galaxy Watch 4 (SM-R860). Keep responses crisp, intelligent, and optimized for a 40mm wrist display (1 to 3 sentences). Address the user as 'sir'."
        }

        return if (customAddition.isNotBlank()) {
            "$basePersona\nAdditional Directive: ${customAddition.trim()}"
        } else {
            basePersona
        }
    }
}
