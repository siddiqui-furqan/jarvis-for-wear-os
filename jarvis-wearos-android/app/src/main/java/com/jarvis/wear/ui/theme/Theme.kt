package com.jarvis.wear.ui.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

enum class ReactorTheme(val id: String, val label: String, val subtitle: String) {
    MARK_I("mark1", "MARK I", "10 Copper Palladium Coils"),
    MARK_II("mark2", "MARK II", "8-Segment Precision Ring"),
    MARK_III("mark3", "MARK III", "Tri-Strut Triangular Core"),
    NANO("nano", "MARK L NANO", "Hexagonal Nanotech Lattice");

    companion object {
        fun fromId(id: String): ReactorTheme =
            entries.firstOrNull { it.id.equals(id, ignoreCase = true) } ?: MARK_II
    }
}

enum class OperationalState(val label: String) {
    IDLE("ONLINE"),
    LISTENING("LISTENING"),
    PROCESSING("ANALYZING"),
    SPEAKING("SPEAKING"),
    DISCONNECTED("OFFLINE"),
    ERROR("FAULT")
}

enum class WatchChassisTheme(val id: String, val label: String, val bezelColor: Color) {
    BLACK("black", "Phantom Black", Color(0xFF18202C)),
    SILVER("silver", "Classic Silver", Color(0xFF94A3B8)),
    PINK_GOLD("pink_gold", "Pink Gold", Color(0xFFD4A393));

    companion object {
        fun fromId(id: String): WatchChassisTheme =
            entries.firstOrNull { it.id.equals(id, ignoreCase = true) } ?: BLACK
    }
}

@Composable
fun JarvisWearTheme(
    isAmbient: Boolean = false,
    content: @Composable () -> Unit
) {
    val backgroundBrush = androidx.compose.runtime.remember(isAmbient) {
        if (isAmbient) {
            Brush.radialGradient(listOf(Color.Black, Color.Black))
        } else {
            Brush.radialGradient(
                colors = listOf(
                    Color(0xFF061529),
                    DeepNavy,
                    ObsidianBlack
                )
            )
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(brush = backgroundBrush)
    ) {
        content()
    }
}
