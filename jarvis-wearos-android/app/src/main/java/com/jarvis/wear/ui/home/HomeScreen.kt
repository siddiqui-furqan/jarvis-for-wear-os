package com.jarvis.wear.ui.home

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.VolumeOff
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material3.Icon
import androidx.wear.compose.material3.Text
import com.jarvis.wear.presentation.HomeReactorInteractionPolicy
import com.jarvis.wear.suggestions.SuggestionItem
import com.jarvis.wear.ui.components.CircularBezelTelemetryOverlay
import com.jarvis.wear.ui.components.HomeOrbitalDock
import com.jarvis.wear.ui.components.WatchTopTelemetryBar
import com.jarvis.wear.ui.components.rememberCircularResponsiveSpec
import com.jarvis.wear.ui.reactor.ArcReactorCanvas
import com.jarvis.wear.ui.theme.*

/**
 * J.A.R.V.I.S. Wear OS V6 Responsive Primary Arc Reactor Assistant Interface.
 *
 * Calibrated around the Samsung Galaxy Watch 4 (SM-R860, 40mm, 396x396px = 198dp x 198dp @ 2.0x)
 * while scaling proportionally across all 9 round-display profiles (320x320 through 480x480) via
 * [rememberCircularResponsiveSpec] and [BoxWithConstraints].
 *
 * Key V6 Architecture Guarantees:
 * 1. Top bar displays only Time, Wi-Fi/Link icon, and Battery percentage + icon (no AI provider label).
 * 2. The assistant remains on the Home screen throughout the entire voice interaction
 *    (IDLE -> LISTENING -> PROCESSING -> SPEAKING -> IDLE) without navigating to Dialogue.
 * 3. A responsive, invariant-height caption/interactive slot (`spec.reservedCaptionSlotHeightDp`)
 *    is reserved beneath the Arc Reactor status lines so the Arc Reactor NEVER shifts position
 *    or resizes when captions appear, update, or clear.
 */
@Composable
fun HomeScreen(
    state: OperationalState,
    reactorTheme: ReactorTheme,
    aodTheme: String = "minimal_reactor",
    greeting: String,
    timeString: String,
    batteryPercent: Int,
    statusText: String,
    liveTranscript: String,
    activeCaption: String,
    homeCaptionsEnabled: Boolean,
    suggestions: List<SuggestionItem>,
    suggestionsEnabled: Boolean,
    messageCount: Int,
    isAmbient: Boolean,
    onTapReactorOrVoice: () -> Unit,
    onStopSpeech: () -> Unit,
    onSelectSuggestion: (String) -> Unit,
    onDismissSuggestion: (String) -> Unit,
    onOpenDialogue: () -> Unit,
    onOpenSystemMatrix: () -> Unit
) {
    var inlineCommand by remember { mutableStateOf("") }
    val separatorPath = remember { Path() }

    BoxWithConstraints(
        contentAlignment = Alignment.Center,
        modifier = Modifier.fillMaxSize()
    ) {
        val spec = rememberCircularResponsiveSpec(
            maxWidth = maxWidth,
            maxHeight = maxHeight
        )
        val fs = spec.fontScale

        // 1. Circular Bezel Telemetry & 36-Tick Ring
        CircularBezelTelemetryOverlay(isAmbient = isAmbient)

        if (isAmbient) {
            // Minimal Always-On Display (AOD) Mode — Zero continuous animations
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
                modifier = Modifier
                    .fillMaxSize()
                    .padding((16f * spec.scaleFactor).dp)
            ) {
                Text(
                    text = timeString,
                    color = AodStroke,
                    fontSize = (13f * fs).sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Medium,
                    letterSpacing = 1.8.sp
                )
                if (aodTheme != "stealth_digital") {
                    Spacer(modifier = Modifier.height(4.dp))
                    ArcReactorCanvas(
                        state = OperationalState.IDLE,
                        theme = reactorTheme,
                        isAmbient = true,
                        sizeDp = (52f * spec.scaleFactor).dp
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "J.A.R.V.I.S. · $batteryPercent%",
                    color = AodDim,
                    fontSize = (6.5f * fs).sp,
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 1.2.sp
                )
            }
            return@BoxWithConstraints
        }

        val stateLabel = when (state) {
            OperationalState.LISTENING -> "LISTENING"
            OperationalState.PROCESSING -> "PROCESSING"
            OperationalState.SPEAKING -> "SPEAKING"
            OperationalState.DISCONNECTED -> "OFFLINE"
            OperationalState.ERROR -> "SYSTEM ALERT"
            OperationalState.IDLE -> "ONLINE · READY"
        }

        val stateSubtitle = when (state) {
            OperationalState.LISTENING -> if (liveTranscript.isNotBlank()) "“$liveTranscript”" else "Speak now or type below, sir"
            OperationalState.PROCESSING -> "Synthesizing telemetry…"
            OperationalState.SPEAKING -> "Audio transmission active · Tap core to mute"
            OperationalState.DISCONNECTED -> "Local contingency core"
            OperationalState.ERROR -> if (statusText.isNotBlank()) statusText else "Tap core to re-initialize"
            OperationalState.IDLE -> greeting
        }

        val stateColor = when (state) {
            OperationalState.ERROR -> StateErrorPrimary
            OperationalState.DISCONNECTED -> StateDisconnectedPrimary
            OperationalState.PROCESSING -> StateProcessingPrimary
            else -> StarkCyan
        }

        val visibleCaption = HomeReactorInteractionPolicy.resolveVisibleHomeCaption(
            homeCaptionsEnabled = homeCaptionsEnabled,
            operationalState = state,
            activeCaption = activeCaption
        )

        // Structured 3-Zone Non-Overlapping Column inside Responsive Circular Viewport
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier
                .fillMaxSize()
                .padding(
                    horizontal = spec.outerHorizontalPaddingDp.dp,
                    vertical = spec.outerVerticalPaddingDp.dp
                )
        ) {
            // Zone 1: Top Curved Watch Status Bar (Time • Wi-Fi • Battery% + Icon)
            WatchTopTelemetryBar(
                timeString = timeString,
                batteryPercent = batteryPercent,
                isOnline = state != OperationalState.DISCONNECTED,
                spec = spec
            )

            // Zone 2: Invariant Center-Outward Focal Anchor (Arc Reactor + Curved Arc + Status + Greeting)
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
                modifier = Modifier.weight(1f)
            ) {
                ArcReactorCanvas(
                    state = state,
                    theme = reactorTheme,
                    isAmbient = false,
                    sizeDp = spec.homeReactorSizeDp.dp,
                    onClick = onTapReactorOrVoice
                )

                // Curved Arc Separator beneath Reactor
                Canvas(
                    modifier = Modifier
                        .width((72f * spec.scaleFactor).dp)
                        .height(4.dp)
                        .padding(top = 1.dp)
                ) {
                    separatorPath.rewind()
                    separatorPath.moveTo(4f, 1f)
                    separatorPath.quadraticBezierTo(size.width / 2f, size.height, size.width - 4f, 1f)
                    drawPath(
                        path = separatorPath,
                        color = stateColor.copy(alpha = 0.7f),
                        style = Stroke(width = 0.8.dp.toPx(), cap = StrokeCap.Round)
                    )
                }

                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.height((10f * spec.scaleFactor).coerceIn(8f, 13f).dp)
                ) {
                    Text(
                        text = stateLabel,
                        color = stateColor,
                        fontSize = (6.4f * fs).sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.1.sp,
                        maxLines = 1
                    )
                }

                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .widthIn(max = spec.reservedCaptionSlotWidthDp.dp)
                        .height((11f * spec.scaleFactor).coerceIn(9f, 14f).dp)
                ) {
                    Text(
                        text = stateSubtitle,
                        color = HologramWhite.copy(alpha = 0.92f),
                        fontSize = (6.6f * fs).sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        textAlign = TextAlign.Center
                    )
                }
            }

            // Zone 3: Invariant Reserved Caption / Interactive Slot + Orbital Circular Dock
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(2.dp),
                modifier = Modifier.padding(bottom = 1.dp)
            ) {
                // Reserved slot guarantees the Arc Reactor NEVER shifts position or resizes
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .width(spec.reservedCaptionSlotWidthDp.dp)
                        .height(spec.reservedCaptionSlotHeightDp.dp)
                ) {
                    when {
                        state == OperationalState.LISTENING -> {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(3.dp),
                                modifier = Modifier
                                    .width((spec.reservedCaptionSlotWidthDp * 0.94f).dp)
                                    .height((18f * spec.scaleFactor).coerceIn(15f, 22f).dp)
                                    .clip(RoundedCornerShape(9.dp))
                                    .background(DarkPanel.copy(alpha = 0.95f))
                                    .border(0.8.dp, StarkCyan.copy(alpha = 0.7f), RoundedCornerShape(9.dp))
                                    .padding(horizontal = 6.dp)
                            ) {
                                BasicTextField(
                                    value = if (inlineCommand.isNotEmpty()) inlineCommand else liveTranscript,
                                    onValueChange = { inlineCommand = it },
                                    singleLine = true,
                                    textStyle = TextStyle(
                                        color = HologramWhite,
                                        fontSize = (6.6f * fs).sp,
                                        fontFamily = FontFamily.Monospace
                                    ),
                                    cursorBrush = SolidColor(StarkCyan),
                                    modifier = Modifier.weight(1f)
                                )
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(StarkCyan)
                                        .clickable(role = Role.Button) {
                                            val cmd = (inlineCommand.ifBlank { liveTranscript }.ifBlank { "Status report" }).trim()
                                            inlineCommand = ""
                                            onSelectSuggestion(cmd)
                                        }
                                        .padding(horizontal = 4.dp, vertical = 1.5.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Send,
                                        contentDescription = "Send Voice Command",
                                        tint = ObsidianBlack,
                                        modifier = Modifier.size((6f * fs).dp)
                                    )
                                    Spacer(modifier = Modifier.width(2.dp))
                                    Text(
                                        text = "SEND",
                                        color = ObsidianBlack,
                                        fontSize = (5.4f * fs).sp,
                                        fontWeight = FontWeight.ExtraBold
                                    )
                                }
                            }
                        }

                        visibleCaption.isNotEmpty() -> {
                            // V5/V6 Home-Screen Spoken Response Caption (2-3 lines max, ellipsis truncation)
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier
                                    .fillMaxSize()
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(DarkPanel.copy(alpha = 0.65f))
                                    .border(
                                        width = 0.6.dp,
                                        color = if (state == OperationalState.SPEAKING) StarkCyan.copy(alpha = 0.55f) else StarkCyan.copy(alpha = 0.25f),
                                        shape = RoundedCornerShape(8.dp)
                                    )
                                    .clickable(
                                        enabled = state == OperationalState.SPEAKING,
                                        role = Role.Button,
                                        onClick = onStopSpeech
                                    )
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = visibleCaption,
                                    color = HologramWhite.copy(alpha = 0.95f),
                                    fontSize = (6.4f * fs).sp,
                                    lineHeight = (8.2f * fs).sp,
                                    maxLines = 3,
                                    overflow = TextOverflow.Ellipsis,
                                    textAlign = TextAlign.Center
                                )
                            }
                        }

                        state == OperationalState.SPEAKING -> {
                            // Shown when speaking and Home Screen Captions are disabled
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(3.dp),
                                modifier = Modifier
                                    .clip(RoundedCornerShape(9.dp))
                                    .background(StateErrorPrimary.copy(alpha = 0.22f))
                                    .border(0.8.dp, StateErrorPrimary.copy(alpha = 0.6f), RoundedCornerShape(9.dp))
                                    .clickable(role = Role.Button, onClick = onStopSpeech)
                                    .padding(horizontal = 8.dp, vertical = 3.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.VolumeOff,
                                    contentDescription = "Stop Voice Playback",
                                    tint = StateErrorPrimary,
                                    modifier = Modifier.size((7f * fs).dp)
                                )
                                Text(
                                    text = "Stop Voice Playback",
                                    color = HologramWhite,
                                    fontSize = (6.0f * fs).sp,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                        }

                        suggestionsEnabled && suggestions.isNotEmpty() && state == OperationalState.IDLE -> {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(1.dp),
                                modifier = Modifier.width((spec.reservedCaptionSlotWidthDp * 0.92f).dp)
                            ) {
                                suggestions.take(2).forEach { item ->
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(horizontal = 4.dp, vertical = 0.5.dp)
                                    ) {
                                        Text(
                                            text = "›",
                                            color = StarkCyan.copy(alpha = 0.8f),
                                            fontSize = (6.3f * fs).sp,
                                            fontFamily = FontFamily.Monospace
                                        )
                                        Text(
                                            text = item.shortLabel,
                                            color = HologramWhite.copy(alpha = 0.9f),
                                            fontSize = (6.3f * fs).sp,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                            textAlign = TextAlign.Center,
                                            modifier = Modifier
                                                .weight(1f)
                                                .clickable(role = Role.Button) {
                                                    onSelectSuggestion(item.command)
                                                }
                                                .padding(horizontal = 3.dp)
                                        )
                                        Text(
                                            text = "×",
                                            color = MutedSlate,
                                            fontSize = (6.8f * fs).sp,
                                            modifier = Modifier
                                                .clickable(role = Role.Button) {
                                                    onDismissSuggestion(item.id)
                                                }
                                                .padding(horizontal = 2.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // Orbital Circular Navigation Dock along the Bottom Curve
                HomeOrbitalDock(
                    state = state,
                    messageCount = messageCount,
                    onOpenDialogue = onOpenDialogue,
                    onVoiceAction = onTapReactorOrVoice,
                    onOpenSystemMatrix = onOpenSystemMatrix,
                    spec = spec
                )
            }
        }
    }
}
