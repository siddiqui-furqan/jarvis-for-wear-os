package com.jarvis.wear.ui.reactor

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.repeatOnLifecycle
import com.jarvis.wear.ui.theme.*
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * Precomputed static trigonometry and dash PathEffects for J.A.R.V.I.S. Wear OS V5.
 * Eliminates per-frame floatArrayOf/PathEffect/listOf/cos/sin allocations inside the 60fps Canvas loop
 * on the Samsung Galaxy Watch 4 (SM-R860) Exynos W920 GPU.
 */
private object ArcReactorGeometryCache {
    private const val DEG_TO_RAD = (PI / 180.0).toFloat()

    val outerCalibrationDash: PathEffect = PathEffect.dashPathEffect(floatArrayOf(18f, 10f, 4f, 10f), 0f)
    val ambientDash: PathEffect = PathEffect.dashPathEffect(floatArrayOf(12f, 12f), 0f)
    val markITurbineDash: PathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 8f), 0f)
    val markIIHarmonicDash: PathEffect = PathEffect.dashPathEffect(floatArrayOf(14f, 8f, 4f, 8f), 0f)
    val markIIIContainmentDash: PathEffect = PathEffect.dashPathEffect(floatArrayOf(24f, 10f), 0f)

    // 4 Cardinal Bezel Notches (0, 90, 180, 270 deg)
    val cardinalCos = floatArrayOf(1f, 0f, -1f, 0f)
    val cardinalSin = floatArrayOf(0f, 1f, 0f, -1f)

    // 3 Triangular Core Vertices (-90, 30, 150 deg)
    val triCos = FloatArray(3) { i -> cos((i * 120f - 90f) * DEG_TO_RAD) }
    val triSin = FloatArray(3) { i -> sin((i * 120f - 90f) * DEG_TO_RAD) }

    // 6 Outer Hex Vertices (-30, 30, 90, 150, 210, 270 deg)
    val outerHexCos = FloatArray(6) { i -> cos((i * 60f - 30f) * DEG_TO_RAD) }
    val outerHexSin = FloatArray(6) { i -> sin((i * 60f - 30f) * DEG_TO_RAD) }

    // 6 Inner Hex Vertices (0, 60, 120, 180, 240, 300 deg)
    val innerHexCos = FloatArray(6) { i -> cos((i * 60f) * DEG_TO_RAD) }
    val innerHexSin = FloatArray(6) { i -> sin((i * 60f) * DEG_TO_RAD) }

    // 24 Speaking Harmonic Bars
    val harmonicCos = FloatArray(24) { i -> cos((i * 15f) * DEG_TO_RAD) }
    val harmonicSin = FloatArray(24) { i -> sin((i * 15f) * DEG_TO_RAD) }
}

/**
 * Native Jetpack Compose Canvas implementation of the JARVIS V5 Primary Arc Reactor Assistant Interface.
 * Supports all 4 selectable reactor themes (Mark I, Mark II, Mark III, Mark L Nanotech),
 * all 6 operational states (Idle, Listening, Processing, Speaking, Disconnected, Error),
 * Always-On Display (AOD) low-power wireframe mode, and zero-allocation 60fps draw paths
 * on the Samsung Galaxy Watch 4 (SM-R860).
 */
@Composable
fun ArcReactorCanvas(
    state: OperationalState,
    theme: ReactorTheme,
    isAmbient: Boolean = false,
    sizeDp: Dp = 158.dp,
    onClick: (() -> Unit)? = null
) {
    val lifecycleOwner = LocalLifecycleOwner.current
    var isResumed by remember { mutableStateOf(true) }

    LaunchedEffect(lifecycleOwner) {
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            isResumed = true
        }
    }

    val shouldAnimate = !isAmbient && isResumed && state != OperationalState.DISCONNECTED

    val primaryColor = remember(isAmbient, state) {
        when {
            isAmbient -> AodStroke
            state == OperationalState.ERROR -> StateErrorPrimary
            state == OperationalState.DISCONNECTED -> StateDisconnectedPrimary
            state == OperationalState.LISTENING -> StateListeningPrimary
            state == OperationalState.PROCESSING -> StateProcessingPrimary
            state == OperationalState.SPEAKING -> StateSpeakingPrimary
            else -> StateIdlePrimary
        }
    }

    val secondaryColor = remember(isAmbient, state, theme) {
        when {
            isAmbient -> AodDim
            state == OperationalState.ERROR -> StateErrorSecondary
            state == OperationalState.DISCONNECTED -> StateDisconnectedSecondary
            theme == ReactorTheme.MARK_I && state == OperationalState.IDLE -> PalladiumAmber
            state == OperationalState.LISTENING -> StateListeningSecondary
            state == OperationalState.PROCESSING -> StateProcessingSecondary
            state == OperationalState.SPEAKING -> StateSpeakingSecondary
            else -> StateIdleSecondary
        }
    }

    val rotationDuration = remember(state) {
        when (state) {
            OperationalState.PROCESSING -> 3800
            OperationalState.LISTENING -> 8500
            OperationalState.SPEAKING -> 7000
            OperationalState.ERROR -> 3200
            else -> 18000
        }
    }

    val pulseDuration = remember(state) {
        when (state) {
            OperationalState.SPEAKING -> 580
            OperationalState.LISTENING -> 900
            OperationalState.PROCESSING -> 750
            OperationalState.ERROR -> 520
            else -> 2800
        }
    }

    val infiniteTransition = rememberInfiniteTransition(label = "ArcReactorEngine")

    val cwRotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = if (shouldAnimate) 360f else 0f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = rotationDuration, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "ClockwiseRotation"
    )

    val ccwRotation by infiniteTransition.animateFloat(
        initialValue = 360f,
        targetValue = if (shouldAnimate) 0f else 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = (rotationDuration * 1.25f).toInt(), easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "CounterClockwiseRotation"
    )

    val corePulse by infiniteTransition.animateFloat(
        initialValue = 0.88f,
        targetValue = if (shouldAnimate) 1.14f else 0.92f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = pulseDuration, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "CorePulse"
    )

    // Reusable Path instances to prevent per-frame heap allocations
    val reusablePrimaryPath = remember { Path() }
    val reusableSecondaryPath = remember { Path() }

    val interactionSource = remember { MutableInteractionSource() }
    val clickModifier = if (onClick != null && !isAmbient) {
        Modifier.clickable(
            interactionSource = interactionSource,
            indication = null,
            role = Role.Button,
            onClick = onClick
        )
    } else {
        Modifier
    }

    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .size(sizeDp)
            .semantics {
                contentDescription = "JARVIS Arc Reactor (${theme.label}) - State: ${state.label}"
            }
            .then(clickModifier)
    ) {
        Canvas(modifier = Modifier.size(sizeDp)) {
            val center = Offset(size.width / 2f, size.height / 2f)
            val maxR = size.minDimension / 2f

            if (isAmbient) {
                drawAmbientReactor(center, maxR, primaryColor, secondaryColor)
                return@Canvas
            }

            // 1. Ambient Holographic Halo Glow
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        primaryColor.copy(alpha = 0.25f * corePulse),
                        secondaryColor.copy(alpha = 0.09f),
                        Color.Transparent
                    ),
                    center = center,
                    radius = maxR
                ),
                radius = maxR,
                center = center
            )

            // 2. Outer Calibration Telemetry Ring (Clockwise)
            rotate(degrees = cwRotation, pivot = center) {
                drawCircle(
                    color = primaryColor.copy(alpha = 0.55f),
                    radius = maxR * 0.92f,
                    center = center,
                    style = Stroke(
                        width = 1.5.dp.toPx(),
                        pathEffect = ArcReactorGeometryCache.outerCalibrationDash
                    )
                )

                // 4 Cardinal Bezel Notches (using precomputed unit vectors)
                val innerR = maxR * 0.86f
                val outerR = maxR * 0.96f
                val notchWidth = 2.dp.toPx()
                for (i in 0 until 4) {
                    val cx = ArcReactorGeometryCache.cardinalCos[i]
                    val sy = ArcReactorGeometryCache.cardinalSin[i]
                    drawLine(
                        color = primaryColor,
                        start = Offset(center.x + cx * innerR, center.y + sy * innerR),
                        end = Offset(center.x + cx * outerR, center.y + sy * outerR),
                        strokeWidth = notchWidth,
                        cap = StrokeCap.Round
                    )
                }
            }

            // 3. Theme-Specific Reactor Geometry
            when (theme) {
                ReactorTheme.MARK_I -> drawMarkICoils(center, maxR, cwRotation, ccwRotation, primaryColor, secondaryColor)
                ReactorTheme.MARK_II -> drawMarkIISegments(center, maxR, cwRotation, ccwRotation, primaryColor, secondaryColor)
                ReactorTheme.MARK_III -> drawMarkIIITriCore(
                    center,
                    maxR,
                    cwRotation,
                    ccwRotation,
                    primaryColor,
                    secondaryColor,
                    reusablePrimaryPath
                )
                ReactorTheme.NANO -> drawNanoLattice(
                    center,
                    maxR,
                    cwRotation,
                    ccwRotation,
                    primaryColor,
                    secondaryColor,
                    reusablePrimaryPath,
                    reusableSecondaryPath
                )
            }

            // 4. Operational State Reactive Overlay
            when (state) {
                OperationalState.LISTENING -> drawListeningRipples(center, maxR, corePulse, primaryColor)
                OperationalState.PROCESSING -> drawProcessingSweepArcs(center, maxR, cwRotation, primaryColor)
                OperationalState.SPEAKING -> drawSpeakingHarmonics(center, maxR, corePulse, primaryColor)
                OperationalState.ERROR -> drawErrorFaultCrosshair(center, maxR, primaryColor)
                else -> Unit
            }

            // 5. Central Plasma Core
            val coreRadius = maxR * 0.25f * corePulse
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        Color.White,
                        primaryColor,
                        primaryColor.copy(alpha = 0.2f),
                        Color.Transparent
                    ),
                    center = center,
                    radius = coreRadius * 1.6f
                ),
                radius = coreRadius * 1.6f,
                center = center
            )

            drawCircle(
                color = primaryColor,
                radius = coreRadius * 0.78f,
                center = center
            )

            drawCircle(
                color = Color.White,
                radius = coreRadius * 0.42f,
                center = center
            )
        }
    }
}

private fun DrawScope.drawAmbientReactor(
    center: Offset,
    maxR: Float,
    strokeColor: Color,
    dimColor: Color
) {
    drawCircle(
        color = dimColor,
        radius = maxR * 0.85f,
        center = center,
        style = Stroke(
            width = 1.dp.toPx(),
            pathEffect = ArcReactorGeometryCache.ambientDash
        )
    )
    drawCircle(
        color = strokeColor,
        radius = maxR * 0.56f,
        center = center,
        style = Stroke(width = 1.2.dp.toPx())
    )
    drawCircle(
        color = strokeColor,
        radius = maxR * 0.22f,
        center = center,
        style = Stroke(width = 1.dp.toPx())
    )
}

private fun DrawScope.drawMarkICoils(
    center: Offset,
    maxR: Float,
    cwRotation: Float,
    ccwRotation: Float,
    primary: Color,
    copper: Color
) {
    // Inner Palladium Ring
    drawCircle(
        color = primary.copy(alpha = 0.65f),
        radius = maxR * 0.66f,
        center = center,
        style = Stroke(width = 4.dp.toPx())
    )

    // 10 Copper-Wound Radial Coils
    rotate(degrees = ccwRotation * 0.4f, pivot = center) {
        val coilCount = 10
        val sweep = 18f
        val step = 36f
        val arcSize = Size(maxR * 1.36f, maxR * 1.36f)
        val topLeft = Offset(center.x - maxR * 0.68f, center.y - maxR * 0.68f)
        val coilStroke = Stroke(width = 6.dp.toPx(), cap = StrokeCap.Butt)

        for (i in 0 until coilCount) {
            drawArc(
                color = copper,
                startAngle = i * step,
                sweepAngle = sweep,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = coilStroke
            )
        }
    }

    // Inner Turbine Ring
    rotate(degrees = cwRotation, pivot = center) {
        drawCircle(
            color = primary.copy(alpha = 0.7f),
            radius = maxR * 0.45f,
            center = center,
            style = Stroke(
                width = 2.dp.toPx(),
                pathEffect = ArcReactorGeometryCache.markITurbineDash
            )
        )
    }
}

private fun DrawScope.drawMarkIISegments(
    center: Offset,
    maxR: Float,
    cwRotation: Float,
    ccwRotation: Float,
    primary: Color,
    secondary: Color
) {
    // 8 Precision Segmented Emitter Ring
    rotate(degrees = ccwRotation * 0.6f, pivot = center) {
        val segments = 8
        val step = 45f
        val r = maxR * 0.72f
        val topLeft = Offset(center.x - r, center.y - r)
        val arcSize = Size(r * 2f, r * 2f)
        val segmentStroke = Stroke(width = 4.5.dp.toPx(), cap = StrokeCap.Round)

        for (i in 0 until segments) {
            drawArc(
                color = primary.copy(alpha = 0.85f),
                startAngle = i * step + 4f,
                sweepAngle = step - 12f,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = segmentStroke
            )
        }
    }

    // Counter-Rotating Inner Harmonic Ring
    rotate(degrees = cwRotation * 1.1f, pivot = center) {
        drawCircle(
            color = secondary.copy(alpha = 0.75f),
            radius = maxR * 0.52f,
            center = center,
            style = Stroke(
                width = 2.dp.toPx(),
                pathEffect = ArcReactorGeometryCache.markIIHarmonicDash
            )
        )
    }
}

private fun DrawScope.drawMarkIIITriCore(
    center: Offset,
    maxR: Float,
    cwRotation: Float,
    ccwRotation: Float,
    primary: Color,
    secondary: Color,
    triPath: Path
) {
    // Outer Containment Ring
    rotate(degrees = ccwRotation * 0.5f, pivot = center) {
        drawCircle(
            color = secondary.copy(alpha = 0.7f),
            radius = maxR * 0.74f,
            center = center,
            style = Stroke(
                width = 3.dp.toPx(),
                pathEffect = ArcReactorGeometryCache.markIIIContainmentDash
            )
        )
    }

    // Triangular Core Geometry & 3 Structural Struts
    rotate(degrees = cwRotation * 0.45f, pivot = center) {
        val triRadius = maxR * 0.58f
        val strutWidth = 2.dp.toPx()
        triPath.rewind()
        for (i in 0..2) {
            val vx = center.x + ArcReactorGeometryCache.triCos[i] * triRadius
            val vy = center.y + ArcReactorGeometryCache.triSin[i] * triRadius
            if (i == 0) triPath.moveTo(vx, vy) else triPath.lineTo(vx, vy)

            drawLine(
                color = primary.copy(alpha = 0.65f),
                start = center,
                end = Offset(vx, vy),
                strokeWidth = strutWidth
            )
        }
        triPath.close()
        drawPath(
            path = triPath,
            color = primary,
            style = Stroke(width = 2.5.dp.toPx(), join = StrokeJoin.Round)
        )
    }
}

private fun DrawScope.drawNanoLattice(
    center: Offset,
    maxR: Float,
    cwRotation: Float,
    ccwRotation: Float,
    primary: Color,
    secondary: Color,
    outerHexPath: Path,
    innerHexPath: Path
) {
    // Outer Hexagonal Nanotech Matrix
    rotate(degrees = cwRotation * 0.65f, pivot = center) {
        val hexRadius = maxR * 0.72f
        val nodeRadius = 2.5.dp.toPx()
        outerHexPath.rewind()
        for (i in 0..5) {
            val hx = center.x + ArcReactorGeometryCache.outerHexCos[i] * hexRadius
            val hy = center.y + ArcReactorGeometryCache.outerHexSin[i] * hexRadius
            if (i == 0) outerHexPath.moveTo(hx, hy) else outerHexPath.lineTo(hx, hy)

            drawCircle(
                color = primary,
                radius = nodeRadius,
                center = Offset(hx, hy)
            )
        }
        outerHexPath.close()
        drawPath(
            path = outerHexPath,
            color = primary.copy(alpha = 0.8f),
            style = Stroke(width = 2.dp.toPx())
        )
    }

    // Counter-Rotating Inner Star Hex
    rotate(degrees = ccwRotation * 0.9f, pivot = center) {
        val innerHexR = maxR * 0.48f
        innerHexPath.rewind()
        for (i in 0..5) {
            val hx = center.x + ArcReactorGeometryCache.innerHexCos[i] * innerHexR
            val hy = center.y + ArcReactorGeometryCache.innerHexSin[i] * innerHexR
            if (i == 0) innerHexPath.moveTo(hx, hy) else innerHexPath.lineTo(hx, hy)
        }
        innerHexPath.close()
        drawPath(
            path = innerHexPath,
            color = secondary.copy(alpha = 0.75f),
            style = Stroke(width = 1.5.dp.toPx())
        )
    }
}

private fun DrawScope.drawListeningRipples(
    center: Offset,
    maxR: Float,
    pulse: Float,
    color: Color
) {
    drawCircle(
        color = color.copy(alpha = 0.45f),
        radius = maxR * 0.42f * pulse,
        center = center,
        style = Stroke(width = 2.dp.toPx())
    )
    drawCircle(
        color = color.copy(alpha = 0.25f),
        radius = maxR * 0.80f * pulse,
        center = center,
        style = Stroke(width = 1.5.dp.toPx())
    )
}

private fun DrawScope.drawProcessingSweepArcs(
    center: Offset,
    maxR: Float,
    rotation: Float,
    color: Color
) {
    rotate(degrees = rotation * 2.2f, pivot = center) {
        val r = maxR * 0.82f
        val topLeft = Offset(center.x - r, center.y - r)
        val arcSize = Size(r * 2f, r * 2f)
        val sweepStroke = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round)
        drawArc(
            color = color,
            startAngle = 0f,
            sweepAngle = 75f,
            useCenter = false,
            topLeft = topLeft,
            size = arcSize,
            style = sweepStroke
        )
        drawArc(
            color = color,
            startAngle = 180f,
            sweepAngle = 75f,
            useCenter = false,
            topLeft = topLeft,
            size = arcSize,
            style = sweepStroke
        )
    }
}

private fun DrawScope.drawSpeakingHarmonics(
    center: Offset,
    maxR: Float,
    pulse: Float,
    color: Color
) {
    val baseR = maxR * 0.36f
    val barStroke = 2.dp.toPx()
    val barColor = color.copy(alpha = 0.85f)
    for (i in 0 until 24) {
        val cx = ArcReactorGeometryCache.harmonicCos[i]
        val sy = ArcReactorGeometryCache.harmonicSin[i]
        val mod = if (i % 2 == 0) pulse else (2f - pulse)
        val len = maxR * 0.14f * mod
        drawLine(
            color = barColor,
            start = Offset(center.x + cx * baseR, center.y + sy * baseR),
            end = Offset(center.x + cx * (baseR + len), center.y + sy * (baseR + len)),
            strokeWidth = barStroke,
            cap = StrokeCap.Round
        )
    }
}

private fun DrawScope.drawErrorFaultCrosshair(
    center: Offset,
    maxR: Float,
    color: Color
) {
    val r = maxR * 0.62f
    val strokeW = 1.5.dp.toPx()
    val crossColor = color.copy(alpha = 0.7f)
    drawLine(
        color = crossColor,
        start = Offset(center.x - r, center.y),
        end = Offset(center.x + r, center.y),
        strokeWidth = strokeW
    )
    drawLine(
        color = crossColor,
        start = Offset(center.x, center.y - r),
        end = Offset(center.x, center.y + r),
        strokeWidth = strokeW
    )
}
