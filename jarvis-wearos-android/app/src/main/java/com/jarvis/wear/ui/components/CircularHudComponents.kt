package com.jarvis.wear.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.BatteryFull
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material3.Icon
import androidx.wear.compose.material3.Text
import com.jarvis.wear.ui.theme.*
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Size classification for round Wear OS displays across the 9-profile validation matrix
 * (320x320 through 480x480 physical pixels).
 */
enum class CircularDisplayTier {
    COMPACT,  // <= 360px (e.g., 320x320, 360x360)
    STANDARD, // 361px..416px (e.g., 384x384, 396x396 Galaxy Watch 4 40mm default, 400x400, 416x416)
    LARGE     // > 416px (e.g., 432x432, 450x450, 480x480)
}

/**
 * Physical round-display validation profile definition.
 */
data class RoundDisplayProfile(
    val id: String,
    val label: String,
    val resolutionPx: Int,
    val referenceDensity: Float = 2.0f,
    val isDefaultReference: Boolean = false
) {
    val diameterDp: Float get() = resolutionPx / referenceDensity
}

/**
 * J.A.R.V.I.S. Wear OS V6 Responsive Circular Layout Specification.
 *
 * Replaces fixed 198dp x 198dp (396x396px) assumptions with a proportional circular geometry
 * engine derived from actual runtime screen dimensions, density, and safe circular chords.
 * Shared 1:1 with the browser simulator (`computeCircularResponsiveSpec` in `wearOsAudit.ts`).
 */
@Immutable
data class CircularResponsiveSpec(
    val diameterDp: Float,
    val resolutionPx: Int,
    val scaleFactor: Float,
    val fontScale: Float,
    val tier: CircularDisplayTier,
    val outerHorizontalPaddingDp: Float,
    val outerVerticalPaddingDp: Float,
    val headerTopInsetDp: Float,
    val headerSafeWidthDp: Float,
    val headerHeightDp: Float,
    val headerSlotWidthDp: Float,
    val headerButtonSizeDp: Float,
    val contentSafeWidthDp: Float,
    val bottomDockSafeWidthDp: Float,
    val bottomDockHeightDp: Float,
    val bottomDockBottomInsetDp: Float,
    val homeReactorSizeDp: Float,
    val reservedCaptionSlotHeightDp: Float,
    val reservedCaptionSlotWidthDp: Float,
    val homeOrbitalSideNodeSizeDp: Float,
    val homeOrbitalCenterNodeSizeDp: Float,
    val matrixCenterReactorSizeDp: Float,
    val matrixOrbitalNodeSizeDp: Float,
    val matrixNeedsScrollFallback: Boolean,
    val minTouchTargetDp: Float
) {
    companion object {
        const val REFERENCE_DIAMETER_DP = 198f // Samsung Galaxy Watch 4 40mm (396px @ 2.0x density)
        const val REFERENCE_RESOLUTION_PX = 396

        val VALIDATION_MATRIX_PROFILES: List<RoundDisplayProfile> = listOf(
            RoundDisplayProfile("320x320", "Compact layout", 320),
            RoundDisplayProfile("360x360", "Small round layout", 360),
            RoundDisplayProfile("384x384", "Compact/medium layout", 384),
            RoundDisplayProfile("396x396", "Galaxy Watch 4 40mm reference", 396, isDefaultReference = true),
            RoundDisplayProfile("400x400", "Medium layout", 400),
            RoundDisplayProfile("416x416", "Medium/large layout", 416),
            RoundDisplayProfile("432x432", "Larger layout", 432),
            RoundDisplayProfile("450x450", "Large layout", 450),
            RoundDisplayProfile("480x480", "High-resolution layout", 480)
        )

        /**
         * Computes the safe horizontal chord length at vertical offset `yFromTopDp` inside a
         * circular display of `diameterDp` with radial bezel clearance `insetMarginDp`.
         */
        fun computeChordWidthDp(
            diameterDp: Float,
            yFromTopDp: Float,
            insetMarginDp: Float = 6f
        ): Float {
            val r = (diameterDp / 2f) - insetMarginDp
            if (r <= 0f) return 0f
            val dy = abs(yFromTopDp - (diameterDp / 2f))
            if (dy >= r) return 0f
            return 2f * sqrt((r * r) - (dy * dy))
        }

        /**
         * Pure factory computing all responsive circular metrics from available diameter in dp
         * and user font scale.
         */
        fun fromDiameterDp(
            rawDiameterDp: Float,
            density: Float = 2.0f,
            userFontScale: Float = 1.0f
        ): CircularResponsiveSpec {
            val safeDiameterDp = rawDiameterDp.coerceIn(150f, 280f)
            val resolutionPx = (safeDiameterDp * density).roundToInt()
            val scale = (safeDiameterDp / REFERENCE_DIAMETER_DP).coerceIn(0.78f, 1.25f)
            val clampedFontScale = (scale * userFontScale.coerceIn(0.90f, 1.12f)).coerceIn(0.84f, 1.16f)

            val tier = when {
                resolutionPx <= 360 -> CircularDisplayTier.COMPACT
                resolutionPx <= 416 -> CircularDisplayTier.STANDARD
                else -> CircularDisplayTier.LARGE
            }

            val outerHorizontalPaddingDp = (safeDiameterDp * 0.05f).coerceIn(7f, 14f)
            val outerVerticalPaddingDp = (safeDiameterDp * 0.025f).coerceIn(3f, 8f)

            // Header sits at ~15% from the top of the circle so the circular safe chord is wide
            val headerTopInsetDp = (safeDiameterDp * 0.055f).coerceIn(8f, 14f)
            val headerHeightDp = (22f * scale).coerceIn(18f, 27f)
            val headerCenterYDp = headerTopInsetDp + (headerHeightDp * 0.65f)
            val geometricHeaderChordDp = computeChordWidthDp(
                diameterDp = safeDiameterDp,
                yFromTopDp = headerCenterYDp,
                insetMarginDp = (safeDiameterDp * 0.035f).coerceIn(5f, 9f)
            )
            val headerSafeWidthDp = min(
                geometricHeaderChordDp * 0.94f,
                (safeDiameterDp * 0.66f).coerceIn(104f, 160f)
            )
            val headerSlotWidthDp = (26f * scale).coerceIn(21f, 31f)
            val headerButtonSizeDp = (16f * scale).coerceIn(13f, 19f)

            // Middle content safe chord width
            val contentSafeWidthDp = (safeDiameterDp * 0.72f).coerceIn(112f, 178f)

            // Bottom curved action dock sits at ~86% of diameter
            val bottomDockBottomInsetDp = (safeDiameterDp * 0.045f).coerceIn(7f, 12f)
            val bottomDockHeightDp = (24f * scale).coerceIn(20f, 29f)
            val bottomDockCenterYDp = safeDiameterDp - bottomDockBottomInsetDp - (bottomDockHeightDp * 0.60f)
            val geometricDockChordDp = computeChordWidthDp(
                diameterDp = safeDiameterDp,
                yFromTopDp = bottomDockCenterYDp,
                insetMarginDp = (safeDiameterDp * 0.035f).coerceIn(5f, 9f)
            )
            val bottomDockSafeWidthDp = min(
                geometricDockChordDp * 0.94f,
                (safeDiameterDp * 0.64f).coerceIn(100f, 155f)
            )

            // Home screen primary Arc Reactor & invariant reserved caption slot
            val homeReactorSizeDp = (66f * scale).coerceIn(50f, 82f)
            val reservedCaptionSlotHeightDp = (22f * scale).coerceIn(18f, 27f)
            val reservedCaptionSlotWidthDp = (safeDiameterDp * 0.64f).coerceIn(102f, 158f)
            val homeOrbitalSideNodeSizeDp = (17f * scale).coerceIn(14f, 21f)
            val homeOrbitalCenterNodeSizeDp = (20f * scale).coerceIn(17f, 25f)

            // System Matrix 6-node radial hub sizing
            val matrixCenterReactorSizeDp = (36f * scale).coerceIn(27f, 44f)
            val matrixOrbitalNodeSizeDp = (28f * scale).coerceIn(22f, 34f)
            val matrixNeedsScrollFallback = tier == CircularDisplayTier.COMPACT

            val minTouchTargetDp = (22f * scale).coerceIn(18f, 26f)

            return CircularResponsiveSpec(
                diameterDp = safeDiameterDp,
                resolutionPx = resolutionPx,
                scaleFactor = scale,
                fontScale = clampedFontScale,
                tier = tier,
                outerHorizontalPaddingDp = outerHorizontalPaddingDp,
                outerVerticalPaddingDp = outerVerticalPaddingDp,
                headerTopInsetDp = headerTopInsetDp,
                headerSafeWidthDp = headerSafeWidthDp,
                headerHeightDp = headerHeightDp,
                headerSlotWidthDp = headerSlotWidthDp,
                headerButtonSizeDp = headerButtonSizeDp,
                contentSafeWidthDp = contentSafeWidthDp,
                bottomDockSafeWidthDp = bottomDockSafeWidthDp,
                bottomDockHeightDp = bottomDockHeightDp,
                bottomDockBottomInsetDp = bottomDockBottomInsetDp,
                homeReactorSizeDp = homeReactorSizeDp,
                reservedCaptionSlotHeightDp = reservedCaptionSlotHeightDp,
                reservedCaptionSlotWidthDp = reservedCaptionSlotWidthDp,
                homeOrbitalSideNodeSizeDp = homeOrbitalSideNodeSizeDp,
                homeOrbitalCenterNodeSizeDp = homeOrbitalCenterNodeSizeDp,
                matrixCenterReactorSizeDp = matrixCenterReactorSizeDp,
                matrixOrbitalNodeSizeDp = matrixOrbitalNodeSizeDp,
                matrixNeedsScrollFallback = matrixNeedsScrollFallback,
                minTouchTargetDp = minTouchTargetDp
            )
        }
    }
}

/**
 * Computes and remembers [CircularResponsiveSpec] from actual runtime screen constraints,
 * system window insets, density, and user font scale.
 */
@Composable
fun rememberCircularResponsiveSpec(
    maxWidth: Dp = Dp.Unspecified,
    maxHeight: Dp = Dp.Unspecified
): CircularResponsiveSpec {
    val configuration = LocalConfiguration.current
    val density = LocalDensity.current
    val systemInsets = WindowInsets.systemBars.asPaddingValues()

    val rawWidthDp = if (maxWidth != Dp.Unspecified && maxWidth.value > 0f) {
        maxWidth.value
    } else {
        configuration.screenWidthDp.toFloat()
    }
    val rawHeightDp = if (maxHeight != Dp.Unspecified && maxHeight.value > 0f) {
        maxHeight.value
    } else {
        configuration.screenHeightDp.toFloat()
    }

    val horizontalInsetDp = systemInsets.calculateLeftPadding(androidx.compose.ui.unit.LayoutDirection.Ltr).value +
        systemInsets.calculateRightPadding(androidx.compose.ui.unit.LayoutDirection.Ltr).value
    val verticalInsetDp = systemInsets.calculateTopPadding().value +
        systemInsets.calculateBottomPadding().value

    val availableDiameterDp = min(
        (rawWidthDp - horizontalInsetDp).coerceAtLeast(150f),
        (rawHeightDp - verticalInsetDp).coerceAtLeast(150f)
    )

    return remember(availableDiameterDp, density.density, density.fontScale) {
        CircularResponsiveSpec.fromDiameterDp(
            rawDiameterDp = availableDiameterDp,
            density = density.density,
            userFontScale = density.fontScale
        )
    }
}

/**
 * Draws the subtle 36-tick circular perimeter bezel and inner radial instrumentation rings
 * matching the approved JARVIS circular HUD language.
 */
@Composable
fun CircularBezelTelemetryOverlay(
    isAmbient: Boolean,
    modifier: Modifier = Modifier
) {
    Canvas(modifier = modifier.fillMaxSize()) {
        val center = Offset(size.width / 2f, size.height / 2f)
        val outerRadius = min(size.width, size.height) / 2f - 2.dp.toPx()

        if (!isAmbient) {
            drawCircle(
                color = StarkTeal.copy(alpha = 0.28f),
                radius = outerRadius - 4.dp.toPx(),
                center = center,
                style = Stroke(width = 0.7.dp.toPx())
            )
        }

        val tickCount = 36
        for (i in 0 until tickCount) {
            val angleDeg = i * (360f / tickCount)
            val angleRad = angleDeg * (PI / 180.0)
            val isMajor = i % 3 == 0
            val tickLen = if (isMajor) 4.dp.toPx() else 2.dp.toPx()
            val rStart = outerRadius - tickLen
            val rEnd = outerRadius

            val start = Offset(
                x = center.x + (rStart * cos(angleRad)).toFloat(),
                y = center.y + (rStart * sin(angleRad)).toFloat()
            )
            val end = Offset(
                x = center.x + (rEnd * cos(angleRad)).toFloat(),
                y = center.y + (rEnd * sin(angleRad)).toFloat()
            )

            val tickColor = when {
                isAmbient && isMajor -> AodStroke
                isAmbient -> AodDim.copy(alpha = 0.4f)
                isMajor -> StarkCyan.copy(alpha = 0.55f)
                else -> StarkTeal.copy(alpha = 0.28f)
            }

            drawLine(
                color = tickColor,
                start = start,
                end = end,
                strokeWidth = if (isMajor) 1.1.dp.toPx() else 0.7.dp.toPx(),
                cap = StrokeCap.Round
            )
        }
    }
}

/**
 * V6 Top Curved Watch Telemetry Bar (`WatchTopTelemetryBar`):
 * Displays ONLY:
 * 1. Current time
 * 2. Wi-Fi / connectivity indicator
 * 3. Battery percentage + icon
 *
 * The AI provider name (`GEMINI`, `OPENAI`, `ROUTER`) has been removed per V6 Requirement 2,
 * and the remaining three elements are balanced and centered inside the top circular safe chord.
 */
@Composable
fun WatchTopTelemetryBar(
    timeString: String,
    batteryPercent: Int,
    isOnline: Boolean,
    spec: CircularResponsiveSpec? = null,
    modifier: Modifier = Modifier
) {
    val resolvedSpec = spec ?: rememberCircularResponsiveSpec()
    val arcPath = remember { Path() }
    val fs = resolvedSpec.fontScale

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier
            .width(resolvedSpec.headerSafeWidthDp.dp)
            .padding(top = (resolvedSpec.headerTopInsetDp * 0.45f).dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp)
        ) {
            Text(
                text = timeString,
                color = HologramWhite.copy(alpha = 0.92f),
                fontSize = (7.2f * fs).sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Medium,
                letterSpacing = 0.5.sp,
                maxLines = 1
            )

            Text(
                text = " · ",
                color = StarkTeal,
                fontSize = (7.2f * fs).sp,
                fontWeight = FontWeight.Bold
            )

            Icon(
                imageVector = if (isOnline) Icons.Default.Wifi else Icons.Default.WifiOff,
                contentDescription = if (isOnline) "Connected" else "Offline",
                tint = if (isOnline) StarkCyan else StateDisconnectedPrimary,
                modifier = Modifier.size((8.2f * fs).dp)
            )

            Text(
                text = " · ",
                color = StarkTeal,
                fontSize = (7.2f * fs).sp,
                fontWeight = FontWeight.Bold
            )

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.BatteryFull,
                    contentDescription = "Battery",
                    tint = StarkCyan.copy(alpha = 0.9f),
                    modifier = Modifier.size((8.0f * fs).dp)
                )
                Text(
                    text = "$batteryPercent%",
                    color = HologramWhite.copy(alpha = 0.90f),
                    fontSize = (7.0f * fs).sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1
                )
            }
        }

        Spacer(modifier = Modifier.height(2.dp))

        // Subtle curved upper bezel separator arc
        Canvas(
            modifier = Modifier
                .fillMaxWidth(0.84f)
                .height(3.dp)
        ) {
            arcPath.rewind()
            arcPath.moveTo(4f, size.height)
            arcPath.quadraticBezierTo(size.width / 2f, 0f, size.width - 4f, size.height)
            drawPath(
                path = arcPath,
                color = StarkTeal.copy(alpha = 0.65f),
                style = Stroke(width = 0.7.dp.toPx(), cap = StrokeCap.Round)
            )
        }
    }
}

/**
 * V6 Top Curved Navigation Header for `DIALOGUE` and `SYSTEM MATRIX` (and all subsections).
 *
 * Uses symmetric fixed-width Left (`Back`) and Right (`HOME` / `CLEAR`) slots inside
 * `spec.headerSafeWidthDp` so that:
 * 1. Back and Home sit comfortably inside the circular safe chord (never pushed against the bezel).
 * 2. The screen title (`weight(1f)`) is mathematically centered on the watch's vertical axis
 *    and truncates cleanly without ever colliding with either button.
 */
@Composable
fun CircularScreenHeader(
    title: String,
    badgeCount: Int? = null,
    rightActionLabel: String,
    onBack: () -> Unit,
    onRightAction: () -> Unit,
    spec: CircularResponsiveSpec? = null,
    modifier: Modifier = Modifier
) {
    val resolvedSpec = spec ?: rememberCircularResponsiveSpec()
    val arcPath = remember { Path() }
    val fs = resolvedSpec.fontScale
    val slotWidth = resolvedSpec.headerSlotWidthDp.dp
    val btnSize = resolvedSpec.headerButtonSizeDp.dp

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier
            .width(resolvedSpec.headerSafeWidthDp.dp)
            .padding(top = (resolvedSpec.headerTopInsetDp * 0.55f).dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier
                .fillMaxWidth()
                .height(resolvedSpec.headerHeightDp.dp)
                .padding(horizontal = 2.dp)
        ) {
            // Left Slot: Symmetric container holding circular Back button
            Box(
                contentAlignment = Alignment.CenterStart,
                modifier = Modifier
                    .width(slotWidth)
                    .fillMaxHeight()
            ) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(btnSize)
                        .clip(CircleShape)
                        .background(DarkPanel)
                        .border(0.8.dp, StarkCyan.copy(alpha = 0.65f), CircleShape)
                        .clickable(role = Role.Button, onClick = onBack)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = StarkCyan,
                        modifier = Modifier.size((btnSize.value * 0.56f).dp)
                    )
                }
            }

            // Center Slot: Mathematically Centered Title + Optional Badge
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 3.dp)
            ) {
                Text(
                    text = title,
                    color = HologramWhite,
                    fontSize = (7.4f * fs).sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.8.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Center
                )
                if (badgeCount != null) {
                    Text(
                        text = " · $badgeCount",
                        color = StarkCyan,
                        fontSize = (7.2f * fs).sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1
                    )
                }
            }

            // Right Slot: Symmetric container of identical width holding Home / Clear button
            Box(
                contentAlignment = Alignment.CenterEnd,
                modifier = Modifier
                    .width(slotWidth)
                    .fillMaxHeight()
            ) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .height(btnSize)
                        .clip(RoundedCornerShape((btnSize.value / 2f).dp))
                        .background(DarkPanel.copy(alpha = 0.88f))
                        .border(
                            0.7.dp,
                            StarkCyan.copy(alpha = 0.50f),
                            RoundedCornerShape((btnSize.value / 2f).dp)
                        )
                        .clickable(role = Role.Button, onClick = onRightAction)
                        .padding(horizontal = 5.dp)
                ) {
                    Text(
                        text = rightActionLabel,
                        color = StarkCyan,
                        fontSize = (6.0f * fs).sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(2.dp))

        Canvas(
            modifier = Modifier
                .fillMaxWidth(0.88f)
                .height(3.dp)
        ) {
            arcPath.rewind()
            arcPath.moveTo(4f, size.height)
            arcPath.quadraticBezierTo(size.width / 2f, 0.5f, size.width - 4f, size.height)
            drawPath(
                path = arcPath,
                color = StarkTeal.copy(alpha = 0.65f),
                style = Stroke(width = 0.7.dp.toPx(), cap = StrokeCap.Round)
            )
        }
    }
}

/**
 * Reusable circular icon button with configurable visual diameter (`sizeDp`) and accessible
 * outer touch target (`touchTargetDp`). Used across circular HUD screens and theme selectors.
 */
@Composable
fun CircularIconButton(
    icon: ImageVector,
    contentDesc: String,
    sizeDp: Dp = 18.dp,
    touchTargetDp: Dp = 24.dp,
    tint: Color = StarkCyan,
    borderColor: Color = StarkCyan.copy(alpha = 0.5f),
    backgroundColor: Color = DarkPanel.copy(alpha = 0.9f),
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val outerSize = if (touchTargetDp > sizeDp) touchTargetDp else sizeDp
    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .size(outerSize)
            .clip(CircleShape)
            .semantics { contentDescription = contentDesc }
            .clickable(role = Role.Button, onClick = onClick)
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(sizeDp)
                .clip(CircleShape)
                .background(backgroundColor)
                .border(0.8.dp, borderColor, CircleShape)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = contentDesc,
                tint = tint,
                modifier = Modifier.size(sizeDp * 0.54f)
            )
        }
    }
}

/**
 * V6 System Matrix Bottom Curved Primary Action Dock (`CurvedPrimaryActionDock`):
 *
 * Per V6 Requirement 1:
 * - Removes the duplicate bottom Back button.
 * - Removes the permanently visible bottom trash/clear button.
 * - Places ONE centered `SAVE CONFIG` button inside a subtle curved/orbital bottom dock
 *   that follows the circular display geometry.
 */
@Composable
fun CurvedPrimaryActionDock(
    label: String,
    icon: ImageVector = Icons.Default.Check,
    backgroundColor: Color = StarkCyan,
    contentColor: Color = ObsidianBlack,
    onClick: () -> Unit,
    spec: CircularResponsiveSpec? = null,
    modifier: Modifier = Modifier
) {
    val resolvedSpec = spec ?: rememberCircularResponsiveSpec()
    val dividerArcPath = remember { Path() }
    val orbitalArcPath = remember { Path() }
    val fs = resolvedSpec.fontScale

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier
            .width(resolvedSpec.bottomDockSafeWidthDp.dp)
            .padding(bottom = (resolvedSpec.bottomDockBottomInsetDp * 0.45f).dp)
    ) {
        // Upper subtle curved divider line
        Canvas(
            modifier = Modifier
                .fillMaxWidth(0.86f)
                .height(3.dp)
        ) {
            dividerArcPath.rewind()
            dividerArcPath.moveTo(4f, 0.5f)
            dividerArcPath.quadraticBezierTo(size.width / 2f, size.height, size.width - 4f, 0.5f)
            drawPath(
                path = dividerArcPath,
                color = StarkTeal.copy(alpha = 0.65f),
                style = Stroke(width = 0.7.dp.toPx(), cap = StrokeCap.Round)
            )
        }

        Spacer(modifier = Modifier.height(2.dp))

        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .fillMaxWidth()
                .height(resolvedSpec.bottomDockHeightDp.dp)
        ) {
            // Subtle curved orbital track cradling the centered primary action button
            Canvas(
                modifier = Modifier
                    .fillMaxWidth(0.84f)
                    .height(14.dp)
                    .align(Alignment.BottomCenter)
            ) {
                orbitalArcPath.rewind()
                orbitalArcPath.moveTo(8f, 2f)
                orbitalArcPath.quadraticBezierTo(
                    size.width / 2f,
                    size.height,
                    size.width - 8f,
                    2f
                )
                drawPath(
                    path = orbitalArcPath,
                    color = StarkTeal.copy(alpha = 0.45f),
                    style = Stroke(width = 0.8.dp.toPx(), cap = StrokeCap.Round)
                )
            }

            // Single Centered Primary Action Pill ("SAVE CONFIG")
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
                modifier = Modifier
                    .height((resolvedSpec.bottomDockHeightDp * 0.78f).coerceIn(18f, 24f).dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(backgroundColor)
                    .border(0.8.dp, StarkCyanGlow, RoundedCornerShape(12.dp))
                    .clickable(role = Role.Button, onClick = onClick)
                    .padding(horizontal = (12f * resolvedSpec.scaleFactor).dp)
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = contentColor,
                    modifier = Modifier.size((8.5f * fs).dp)
                )
                Spacer(modifier = Modifier.width(3.dp))
                Text(
                    text = label,
                    color = contentColor,
                    fontSize = (6.6f * fs).sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 0.5.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

/**
 * Curved 3-Node Orbital Action Dock for the `DIALOGUE` screen:
 * Keeps symmetric left (`Return/Home`) and right (`Scroll/Mute`) circular orbital nodes
 * with generous clearance around the single-line center `FOLLOW UP` / `SEND TEXT` pill.
 */
@Composable
fun CurvedOrbitalActionDock(
    leftIcon: ImageVector,
    leftContentDesc: String,
    onLeftClick: () -> Unit,
    centerIcon: ImageVector,
    centerLabel: String,
    centerBackgroundColor: Color = StarkCyan,
    centerContentColor: Color = ObsidianBlack,
    onCenterClick: () -> Unit,
    rightIcon: ImageVector,
    rightContentDesc: String,
    rightTint: Color = StarkCyan,
    rightBorderColor: Color = StarkCyan.copy(alpha = 0.6f),
    onRightClick: () -> Unit,
    spec: CircularResponsiveSpec? = null,
    modifier: Modifier = Modifier
) {
    val resolvedSpec = spec ?: rememberCircularResponsiveSpec()
    val dividerArcPath = remember { Path() }
    val orbitalArcPath = remember { Path() }
    val fs = resolvedSpec.fontScale
    val sideNodeSize = (18f * resolvedSpec.scaleFactor).coerceIn(15f, 22f).dp

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier
            .width(resolvedSpec.bottomDockSafeWidthDp.dp)
            .padding(bottom = (resolvedSpec.bottomDockBottomInsetDp * 0.45f).dp)
    ) {
        Canvas(
            modifier = Modifier
                .fillMaxWidth(0.88f)
                .height(3.dp)
        ) {
            dividerArcPath.rewind()
            dividerArcPath.moveTo(4f, 0.5f)
            dividerArcPath.quadraticBezierTo(size.width / 2f, size.height, size.width - 4f, 0.5f)
            drawPath(
                path = dividerArcPath,
                color = StarkTeal.copy(alpha = 0.65f),
                style = Stroke(width = 0.7.dp.toPx(), cap = StrokeCap.Round)
            )
        }

        Spacer(modifier = Modifier.height(1.dp))

        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .fillMaxWidth()
                .height(resolvedSpec.bottomDockHeightDp.dp)
        ) {
            Canvas(
                modifier = Modifier
                    .fillMaxWidth(0.86f)
                    .height(14.dp)
                    .align(Alignment.BottomCenter)
            ) {
                orbitalArcPath.rewind()
                orbitalArcPath.moveTo(8f, 2f)
                orbitalArcPath.quadraticBezierTo(
                    size.width / 2f,
                    size.height,
                    size.width - 8f,
                    2f
                )
                drawPath(
                    path = orbitalArcPath,
                    color = StarkTeal.copy(alpha = 0.48f),
                    style = Stroke(width = 0.8.dp.toPx(), cap = StrokeCap.Round)
                )
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 4.dp)
            ) {
                // Left Orbital Node
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .offset(y = (-2).dp)
                        .size(sideNodeSize)
                        .clip(CircleShape)
                        .background(DarkPanel)
                        .border(0.8.dp, StarkCyan.copy(alpha = 0.65f), CircleShape)
                        .clickable(role = Role.Button, onClick = onLeftClick)
                ) {
                    Icon(
                        imageVector = leftIcon,
                        contentDescription = leftContentDesc,
                        tint = StarkCyan,
                        modifier = Modifier.size((sideNodeSize.value * 0.52f).dp)
                    )
                }

                // Center Primary Action Pill (Single-line, never wraps)
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center,
                    modifier = Modifier
                        .offset(y = 1.dp)
                        .height((resolvedSpec.bottomDockHeightDp * 0.76f).coerceIn(18f, 23f).dp)
                        .clip(RoundedCornerShape(11.dp))
                        .background(centerBackgroundColor)
                        .border(
                            0.8.dp,
                            if (centerBackgroundColor == StarkCyan) StarkCyanGlow else centerBackgroundColor,
                            RoundedCornerShape(11.dp)
                        )
                        .clickable(role = Role.Button, onClick = onCenterClick)
                        .padding(horizontal = (8.5f * resolvedSpec.scaleFactor).dp)
                ) {
                    Icon(
                        imageVector = centerIcon,
                        contentDescription = centerLabel,
                        tint = centerContentColor,
                        modifier = Modifier.size((8.0f * fs).dp)
                    )
                    Spacer(modifier = Modifier.width(2.5.dp))
                    Text(
                        text = centerLabel,
                        color = centerContentColor,
                        fontSize = (6.3f * fs).sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = 0.4.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                // Right Orbital Node
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .offset(y = (-2).dp)
                        .size(sideNodeSize)
                        .clip(CircleShape)
                        .background(DarkPanel)
                        .border(0.8.dp, rightBorderColor, CircleShape)
                        .clickable(role = Role.Button, onClick = onRightClick)
                ) {
                    Icon(
                        imageVector = rightIcon,
                        contentDescription = rightContentDesc,
                        tint = rightTint,
                        modifier = Modifier.size((sideNodeSize.value * 0.54f).dp)
                    )
                }
            }
        }
    }
}

/**
 * Bottom Curved Orbital Navigation Dock on the Home Screen:
 * Left = Dialogue (offset y = -3dp)
 * Center = Mic / Voice Trigger (offset y = +1dp, primary cyan circular button)
 * Right = System Matrix Settings (offset y = -3dp)
 */
@Composable
fun HomeOrbitalDock(
    state: OperationalState,
    messageCount: Int,
    onOpenDialogue: () -> Unit,
    onVoiceAction: () -> Unit,
    onOpenSystemMatrix: () -> Unit,
    spec: CircularResponsiveSpec? = null,
    modifier: Modifier = Modifier
) {
    val resolvedSpec = spec ?: rememberCircularResponsiveSpec()
    val arcPath = remember { Path() }
    val sideSize = resolvedSpec.homeOrbitalSideNodeSizeDp.dp
    val centerSize = resolvedSpec.homeOrbitalCenterNodeSizeDp.dp

    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .width((102f * resolvedSpec.scaleFactor).coerceIn(84f, 130f).dp)
            .height((26f * resolvedSpec.scaleFactor).coerceIn(22f, 32f).dp)
    ) {
        Canvas(
            modifier = Modifier
                .fillMaxWidth(0.90f)
                .height(14.dp)
                .align(Alignment.BottomCenter)
        ) {
            arcPath.rewind()
            arcPath.moveTo(8f, 2f)
            arcPath.quadraticBezierTo(size.width / 2f, size.height, size.width - 8f, 2f)
            drawPath(
                path = arcPath,
                color = StarkTeal.copy(alpha = 0.55f),
                style = Stroke(width = 0.8.dp.toPx(), cap = StrokeCap.Round)
            )
        }

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy((12f * resolvedSpec.scaleFactor).dp)
        ) {
            // Left Orbital Node: Dialogue
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .offset(y = (-3).dp)
                    .size(sideSize)
                    .clip(CircleShape)
                    .background(DarkPanel)
                    .border(0.8.dp, StarkCyan.copy(alpha = 0.6f), CircleShape)
                    .clickable(role = Role.Button, onClick = onOpenDialogue)
            ) {
                Icon(
                    imageVector = Icons.Default.ChatBubbleOutline,
                    contentDescription = "Open Dialogue ($messageCount)",
                    tint = StarkCyan,
                    modifier = Modifier.size((sideSize.value * 0.52f).dp)
                )
            }

            // Center Primary Node: Voice Input
            val isListening = state == OperationalState.LISTENING
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .offset(y = 1.dp)
                    .size(centerSize)
                    .clip(CircleShape)
                    .background(if (isListening) StateErrorPrimary else StarkCyan)
                    .border(
                        1.dp,
                        if (isListening) Color.White.copy(alpha = 0.8f) else StarkCyanGlow,
                        CircleShape
                    )
                    .clickable(role = Role.Button, onClick = onVoiceAction)
            ) {
                Icon(
                    imageVector = Icons.Default.Mic,
                    contentDescription = "Trigger Voice Input",
                    tint = if (isListening) HologramWhite else ObsidianBlack,
                    modifier = Modifier.size((centerSize.value * 0.52f).dp)
                )
            }

            // Right Orbital Node: System Matrix
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .offset(y = (-3).dp)
                    .size(sideSize)
                    .clip(CircleShape)
                    .background(DarkPanel)
                    .border(0.8.dp, StarkCyan.copy(alpha = 0.6f), CircleShape)
                    .clickable(role = Role.Button, onClick = onOpenSystemMatrix)
            ) {
                Icon(
                    imageVector = Icons.Default.Settings,
                    contentDescription = "Open System Matrix",
                    tint = StarkCyan,
                    modifier = Modifier.size((sideSize.value * 0.52f).dp)
                )
            }
        }
    }
}
