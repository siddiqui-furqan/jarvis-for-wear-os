package com.jarvis.wear.suggestions

data class SuggestionItem(
    val id: String,
    val shortLabel: String,
    val command: String
)

/**
 * Lightweight on-device Adaptive Suggestion Engine for Samsung Galaxy Watch 4.
 * Analyzes local conversation history and topic frequencies to surface up to 2
 * non-intrusive quick commands on the circular Home screen.
 * No external analytics, telemetry, or cloud tracking is used.
 */
class AdaptiveSuggestionEngine {

    private val dismissedIds = mutableSetOf<String>()

    private val defaultCatalog = listOf(
        SuggestionItem("status", "Status Report", "Run a full system status diagnostic."),
        SuggestionItem("briefing", "Daily Briefing", "Give me a concise executive briefing."),
        SuggestionItem("suit", "Reactor Telemetry", "Report current Arc Reactor core output."),
        SuggestionItem("schedule", "Focus Timer", "Suggest a 25-minute tactical focus protocol."),
        SuggestionItem("weather", "Atmospheric Scan", "Provide an atmospheric and weather assessment.")
    )

    fun computeSuggestions(
        userPrompts: List<String>,
        enabled: Boolean,
        maxCount: Int = 2
    ): List<SuggestionItem> {
        if (!enabled || maxCount <= 0) return emptyList()

        val scored = mutableMapOf<String, Int>()
        defaultCatalog.forEachIndexed { idx, item ->
            scored[item.id] = defaultCatalog.size - idx
        }

        // Boost topics matching recent user commands
        userPrompts.forEach { prompt ->
            val lower = prompt.lowercase()
            when {
                "status" in lower || "diagnostic" in lower ->
                    scored["status"] = (scored["status"] ?: 0) + 5
                "reactor" in lower || "power" in lower || "battery" in lower ->
                    scored["suit"] = (scored["suit"] ?: 0) + 5
                "brief" in lower || "summary" in lower || "news" in lower ->
                    scored["briefing"] = (scored["briefing"] ?: 0) + 5
                "focus" in lower || "timer" in lower || "work" in lower ->
                    scored["schedule"] = (scored["schedule"] ?: 0) + 5
                "weather" in lower || "scan" in lower ->
                    scored["weather"] = (scored["weather"] ?: 0) + 5
            }
        }

        return defaultCatalog
            .filter { it.id !in dismissedIds }
            .sortedByDescending { scored[it.id] ?: 0 }
            .take(maxCount)
    }

    fun dismissSuggestion(id: String) {
        dismissedIds.add(id)
    }

    fun resetDismissed() {
        dismissedIds.clear()
    }
}
