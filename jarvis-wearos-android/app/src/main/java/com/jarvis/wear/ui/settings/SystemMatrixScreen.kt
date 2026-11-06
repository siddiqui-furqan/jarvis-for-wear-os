package com.jarvis.wear.ui.settings

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.rotary.onRotaryScrollEvent
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material3.Icon
import androidx.wear.compose.material3.Text
import com.jarvis.wear.RotaryScrollEvent
import com.jarvis.wear.ai.DiscoveredModel
import com.jarvis.wear.ai.OpenAiProvider
import com.jarvis.wear.data.preferences.JarvisSettingsState
import com.jarvis.wear.ui.components.CircularBezelTelemetryOverlay
import com.jarvis.wear.ui.components.CircularIconButton
import com.jarvis.wear.ui.components.CircularResponsiveSpec
import com.jarvis.wear.ui.components.CircularScreenHeader
import com.jarvis.wear.ui.components.CurvedPrimaryActionDock
import com.jarvis.wear.ui.components.rememberCircularResponsiveSpec
import com.jarvis.wear.ui.reactor.ArcReactorCanvas
import com.jarvis.wear.ui.theme.*
import com.jarvis.wear.voice.WatchVoiceProfile
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

enum class MatrixSection(val title: String, val icon: ImageVector) {
    AI_LINK("AI LINK", Icons.Default.Memory),
    REACTOR("REACTOR", Icons.Default.Adjust),
    VOICE("VOICE", Icons.Default.VolumeUp),
    PERSONA("PERSONA", Icons.Default.Person),
    MEMORY("MEMORY", Icons.Default.Storage),
    ABOUT("ABOUT", Icons.Default.Info)
}

/**
 * Precomputed static geometry for the 6-node Radial System Matrix Hub.
 */
private object MatrixHubGeometryCache {
    private const val DEG_TO_RAD = (PI / 180.0).toFloat()
    val outerDash: PathEffect = PathEffect.dashPathEffect(floatArrayOf(4f, 6f), 0f)
    val spokeCos = FloatArray(6) { i -> cos((30f + i * 60f) * DEG_TO_RAD) }
    val spokeSin = FloatArray(6) { i -> sin((30f + i * 60f) * DEG_TO_RAD) }
}

/**
 * JARVIS V5 Radial System Matrix Hub & 6 Circular Sub-Screens calibrated for the
 * 198dp x 198dp (396x396px @ 2.0x density) Samsung Galaxy Watch 4 circular display.
 * - Preserves the 6-node hexagonal/orbital System Matrix around the central live Arc Reactor.
 * - Uses the unified `CurvedOrbitalActionDock` along the lower inner circumference so
 *   `Back`, `SAVE CONFIG`, and `Clear` match the Home screen's curved orbital design language.
 * - Uses the non-colliding 3-slot `CircularScreenHeader` at the top so buttons never crowd titles.
 * - Upgrades sub-screen controls to 44dp touch targets with smooth rotary bezel scrolling & haptics.
 */
@Composable
fun SystemMatrixScreen(
    settings: JarvisSettingsState,
    availableVoices: List<WatchVoiceProfile>,
    activeVoiceSummary: String,
    discoveredModels: List<DiscoveredModel>,
    isDiscoveringModels: Boolean,
    messageCount: Int,
    maskedKeyPreview: String,
    connectionTestStatus: String,
    rotaryEvents: SharedFlow<RotaryScrollEvent>,
    onRotaryTick: () -> Unit = {},
    onConfirmHaptic: () -> Unit = {},
    onSaveApiKey: (String) -> Unit,
    onClearProviderCredentials: () -> Unit,
    onClearAllCredentials: () -> Unit,
    onDiscoverModels: () -> Unit,
    onTestConnection: () -> Unit,
    onUpdateSettings: (JarvisSettingsState) -> Unit,
    onPreviewVoice: () -> Unit,
    onClearConversationMemory: () -> Unit,
    onResetSuggestions: () -> Unit,
    onCloseToHome: () -> Unit
) {
    var activeSection by remember { mutableStateOf<MatrixSection?>(null) }
    var focusedHubIndex by remember { mutableIntStateOf(0) }
    var saveToast by remember { mutableStateOf(false) }
    var lastRotaryHandledMs by remember { mutableLongStateOf(0L) }

    val scrollState = rememberScrollState()
    val hubScrollState = rememberScrollState()
    val coroutineScope = rememberCoroutineScope()
    val focusRequester = remember { FocusRequester() }

    // Wire custom WearableActivity.onRotaryEvent bezel events (with 25ms deduplication against Compose rotary)
    LaunchedEffect(rotaryEvents, activeSection) {
        rotaryEvents.collect { rotary ->
            val now = System.currentTimeMillis()
            if (now - lastRotaryHandledMs >= 25L) {
                lastRotaryHandledMs = now
                onRotaryTick()
                if (activeSection == null) {
                    val step = if (rotary.clockwise) 1 else -1
                    focusedHubIndex = (focusedHubIndex + step + MatrixSection.entries.size) % MatrixSection.entries.size
                } else {
                    scrollState.scrollBy(rotary.deltaPx)
                }
            }
        }
    }

    LaunchedEffect(activeSection) {
        focusRequester.requestFocus()
        if (activeSection != null) {
            scrollState.scrollTo(0)
        }
    }

    BoxWithConstraints(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .fillMaxSize()
            .onRotaryScrollEvent { event ->
                val now = System.currentTimeMillis()
                if (now - lastRotaryHandledMs >= 25L) {
                    lastRotaryHandledMs = now
                    onRotaryTick()
                    coroutineScope.launch {
                        if (activeSection == null) {
                            val step = if (event.verticalScrollPixels > 0f) 1 else -1
                            focusedHubIndex = (focusedHubIndex + step + MatrixSection.entries.size) % MatrixSection.entries.size
                        } else {
                            scrollState.scrollBy(event.verticalScrollPixels)
                        }
                    }
                }
                true
            }
            .focusRequester(focusRequester)
            .focusable()
    ) {
        val spec = rememberCircularResponsiveSpec(
            maxWidth = maxWidth,
            maxHeight = maxHeight
        )

        CircularBezelTelemetryOverlay(isAmbient = false)

        // 3-Zone Non-Overlapping Column matching SettingsScreen.tsx 1:1
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
            // Zone 1: Top Curved Navigation Header (One Back, One Centered Title, One Home)
            CircularScreenHeader(
                title = activeSection?.title ?: "SYSTEM MATRIX",
                rightActionLabel = "HOME",
                onBack = {
                    if (activeSection == null) onCloseToHome() else activeSection = null
                },
                onRightAction = onCloseToHome,
                spec = spec
            )

            // Zone 2: Center Matrix Hub OR Scrollable Sub-Screen Container
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) {
                if (activeSection == null) {
                    val hubModifier = if (spec.matrixNeedsScrollFallback) {
                        Modifier.verticalScroll(hubScrollState)
                    } else {
                        Modifier
                    }
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = hubModifier
                    ) {
                        RadialMatrixHubCluster(
                            reactorTheme = ReactorTheme.fromId(settings.reactorThemeId),
                            focusedIndex = focusedHubIndex,
                            spec = spec,
                            onSelectSection = { section ->
                                focusedHubIndex = section.ordinal
                                activeSection = section
                            },
                            onTapReactor = { activeSection = MatrixSection.REACTOR }
                        )
                    }
                } else {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(7.dp),
                        modifier = Modifier
                            .width(spec.contentSafeWidthDp.dp)
                            .fillMaxHeight()
                            .verticalScroll(scrollState)
                            .padding(horizontal = 6.dp, vertical = 5.dp)
                    ) {
                        when (activeSection!!) {
                            MatrixSection.AI_LINK -> AiLinkSubScreen(
                                settings = settings,
                                discoveredModels = discoveredModels,
                                isDiscoveringModels = isDiscoveringModels,
                                maskedKeyPreview = maskedKeyPreview,
                                connectionTestStatus = connectionTestStatus,
                                onSaveApiKey = onSaveApiKey,
                                onClearProviderCredentials = onClearProviderCredentials,
                                onClearAllCredentials = onClearAllCredentials,
                                onDiscoverModels = onDiscoverModels,
                                onTestConnection = onTestConnection,
                                onUpdateSettings = onUpdateSettings
                            )

                            MatrixSection.REACTOR -> ReactorSubScreen(
                                settings = settings,
                                onUpdateSettings = onUpdateSettings
                            )

                            MatrixSection.VOICE -> VoiceSubScreen(
                                settings = settings,
                                availableVoices = availableVoices,
                                activeVoiceSummary = activeVoiceSummary,
                                onUpdateSettings = onUpdateSettings,
                                onPreviewVoice = onPreviewVoice
                            )

                            MatrixSection.PERSONA -> PersonaSubScreen(
                                settings = settings,
                                onUpdateSettings = onUpdateSettings
                            )

                            MatrixSection.MEMORY -> MemorySubScreen(
                                settings = settings,
                                messageCount = messageCount,
                                onUpdateSettings = onUpdateSettings,
                                onResetSuggestions = onResetSuggestions,
                                onClearConversationMemory = onClearConversationMemory
                            )

                            MatrixSection.ABOUT -> AboutSubScreen()
                        }
                        Spacer(modifier = Modifier.height(10.dp))
                    }
                }
            }

            // Zone 3: V6 Single Centered SAVE CONFIG Button inside Curved Bottom Dock
            CurvedPrimaryActionDock(
                label = if (saveToast) "SAVED" else "SAVE CONFIG",
                icon = Icons.Default.Check,
                onClick = {
                    onConfirmHaptic()
                    onUpdateSettings(settings)
                    saveToast = true
                    coroutineScope.launch {
                        delay(1600)
                        saveToast = false
                    }
                },
                spec = spec
            )
        }
    }
}

/**
 * 3-Row Hexagonal/Orbital 6-Node Matrix around a Central Live Arc Reactor Core.
 * Scales proportionally across all 9 round-display profiles via [CircularResponsiveSpec].
 */
@Composable
private fun RadialMatrixHubCluster(
    reactorTheme: ReactorTheme,
    focusedIndex: Int,
    spec: CircularResponsiveSpec,
    onSelectSection: (MatrixSection) -> Unit,
    onTapReactor: () -> Unit
) {
    val entries = MatrixSection.entries
    val s = spec.scaleFactor
    val nodeSizeDp = spec.matrixOrbitalNodeSizeDp.dp
    val centerReactorDp = spec.matrixCenterReactorSizeDp.dp

    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .width((144f * s).coerceIn(114f, 176f).dp)
            .height((122f * s).coerceIn(96f, 150f).dp)
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val center = Offset(size.width / 2f, size.height / 2f)
            val outerR = (39f * s).dp.toPx()
            val innerR = (21f * s).dp.toPx()

            drawCircle(
                color = StarkCyan.copy(alpha = 0.28f),
                radius = outerR,
                center = center,
                style = Stroke(
                    width = 0.8.dp.toPx(),
                    pathEffect = MatrixHubGeometryCache.outerDash
                )
            )
            drawCircle(
                color = StarkCyan.copy(alpha = 0.20f),
                radius = innerR,
                center = center,
                style = Stroke(width = 0.6.dp.toPx())
            )

            val spokeStroke = 0.7.dp.toPx()
            val spokeColor = StarkCyan.copy(alpha = 0.22f)
            for (i in 0 until 6) {
                val cx = MatrixHubGeometryCache.spokeCos[i]
                val sy = MatrixHubGeometryCache.spokeSin[i]
                drawLine(
                    color = spokeColor,
                    start = Offset(center.x + cx * innerR, center.y + sy * innerR),
                    end = Offset(center.x + cx * outerR, center.y + sy * outerR),
                    strokeWidth = spokeStroke
                )
            }
        }

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.fillMaxSize()
        ) {
            // Top Orbital Pair: AI LINK & REACTOR
            Row(
                horizontalArrangement = Arrangement.spacedBy((16f * s).dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OrbitalNodeCircle(
                    section = entries[0],
                    isFocused = focusedIndex == 0,
                    nodeSizeDp = nodeSizeDp,
                    fontScale = spec.fontScale,
                    onClick = { onSelectSection(entries[0]) }
                )
                OrbitalNodeCircle(
                    section = entries[1],
                    isFocused = focusedIndex == 1,
                    nodeSizeDp = nodeSizeDp,
                    fontScale = spec.fontScale,
                    onClick = { onSelectSection(entries[1]) }
                )
            }

            // Equator Row: VOICE + Central Live Arc Reactor Core + PERSONA
            Row(
                horizontalArrangement = Arrangement.spacedBy((8f * s).dp),
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(vertical = 1.dp)
            ) {
                OrbitalNodeCircle(
                    section = entries[2],
                    isFocused = focusedIndex == 2,
                    nodeSizeDp = nodeSizeDp,
                    fontScale = spec.fontScale,
                    onClick = { onSelectSection(entries[2]) }
                )

                ArcReactorCanvas(
                    state = OperationalState.IDLE,
                    theme = reactorTheme,
                    isAmbient = false,
                    sizeDp = centerReactorDp,
                    onClick = onTapReactor
                )

                OrbitalNodeCircle(
                    section = entries[3],
                    isFocused = focusedIndex == 3,
                    nodeSizeDp = nodeSizeDp,
                    fontScale = spec.fontScale,
                    onClick = { onSelectSection(entries[3]) }
                )
            }

            // Bottom Orbital Pair: MEMORY & ABOUT
            Row(
                horizontalArrangement = Arrangement.spacedBy((16f * s).dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OrbitalNodeCircle(
                    section = entries[4],
                    isFocused = focusedIndex == 4,
                    nodeSizeDp = nodeSizeDp,
                    fontScale = spec.fontScale,
                    onClick = { onSelectSection(entries[4]) }
                )
                OrbitalNodeCircle(
                    section = entries[5],
                    isFocused = focusedIndex == 5,
                    nodeSizeDp = nodeSizeDp,
                    fontScale = spec.fontScale,
                    onClick = { onSelectSection(entries[5]) }
                )
            }
        }
    }
}

@Composable
private fun OrbitalNodeCircle(
    section: MatrixSection,
    isFocused: Boolean,
    nodeSizeDp: androidx.compose.ui.unit.Dp,
    fontScale: Float,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .size(nodeSizeDp)
            .clip(CircleShape)
            .background(if (isFocused) StarkCyan.copy(alpha = 0.14f) else DarkPanel.copy(alpha = 0.92f))
            .border(
                width = if (isFocused) 1.3.dp else 0.85.dp,
                color = if (isFocused) StarkCyan else StarkCyan.copy(alpha = 0.55f),
                shape = CircleShape
            )
            .clickable(role = Role.Button, onClick = onClick)
    ) {
        Icon(
            imageVector = section.icon,
            contentDescription = section.title,
            tint = StarkCyan,
            modifier = Modifier.size((nodeSizeDp.value * 0.32f).dp)
        )
        Spacer(modifier = Modifier.height(1.dp))
        Text(
            text = section.title,
            color = HologramWhite,
            fontSize = (5.0f * fontScale).sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.4.sp,
            maxLines = 1
        )
    }
}

/**
 * AI Link Dynamic Provider & Model Configuration Sub-Screen with 44dp touch targets.
 */
@Composable
private fun AiLinkSubScreen(
    settings: JarvisSettingsState,
    discoveredModels: List<DiscoveredModel>,
    isDiscoveringModels: Boolean,
    maskedKeyPreview: String,
    connectionTestStatus: String,
    onSaveApiKey: (String) -> Unit,
    onClearProviderCredentials: () -> Unit,
    onClearAllCredentials: () -> Unit = {},
    onDiscoverModels: () -> Unit,
    onTestConnection: () -> Unit,
    onUpdateSettings: (JarvisSettingsState) -> Unit
) {
    var apiKeyDraft by remember(settings.providerId) { mutableStateOf("") }
    var showKey by remember { mutableStateOf(false) }
    var confirmPurgeAll by remember { mutableStateOf(false) }

    val activeModel = settings.activeModelForProvider(settings.providerId)

    // 1. Provider Selector (Gemini, OpenAI, Custom)
    SectionHeaderLabel("AI PROVIDER")
    Row(
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        listOf(
            "gemini" to "GEMINI",
            "openai" to "OPENAI",
            "custom" to "CUSTOM"
        ).forEach { (id, label) ->
            val selected = settings.providerId.equals(id, ignoreCase = true)
            TouchPillButton(
                label = label,
                selected = selected,
                modifier = Modifier.weight(1f),
                onClick = {
                    onUpdateSettings(settings.withSelectedProvider(id))
                }
            )
        }
    }

    // 2. Custom Endpoint Base URL Field (Only shown when Custom provider is selected)
    if (settings.providerId.equals("custom", ignoreCase = true)) {
        SectionHeaderLabel("CUSTOM BASE URL (OPENAI-COMPATIBLE)")
        WatchTextFieldCard(
            value = settings.customBaseUrl,
            placeholder = "https://openrouter.ai/api/v1",
            onValueChange = { newUrl ->
                onUpdateSettings(settings.copy(customBaseUrl = newUrl))
            }
        )
    }

    // 3. Dynamic / Selectable Model Discovery & List
    when (settings.providerId.lowercase()) {
        "gemini" -> {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                SectionHeaderLabel("GEMINI MODEL DISCOVERY")
                Text(
                    text = if (isDiscoveringModels) "SYNCING…" else "↻ FETCH API",
                    color = StarkCyan,
                    fontSize = 7.5.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .clickable(role = Role.Button, onClick = onDiscoverModels)
                        .padding(horizontal = 5.dp, vertical = 3.dp)
                )
            }

            if (discoveredModels.isNotEmpty()) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(5.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    discoveredModels.take(6).forEach { model ->
                        SelectableModelRow(
                            modelId = model.id,
                            subtitle = model.displayName,
                            selected = activeModel == model.id,
                            onClick = {
                                onUpdateSettings(settings.withUpdatedModelForActiveProvider(model.id))
                            }
                        )
                    }
                }
            } else {
                Text(
                    text = "Tap FETCH API with your Gemini key to list live models from Google's Model Discovery API, or enter any Model ID below.",
                    color = MutedSlate,
                    fontSize = 7.8.sp,
                    lineHeight = 10.5.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }

        "openai" -> {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                SectionHeaderLabel("SELECTABLE OPENAI MODELS")
                Text(
                    text = if (isDiscoveringModels) "SYNCING…" else "↻ REFRESH",
                    color = StarkCyan,
                    fontSize = 7.5.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .clickable(role = Role.Button, onClick = onDiscoverModels)
                        .padding(horizontal = 5.dp, vertical = 3.dp)
                )
            }

            val openAiList = if (discoveredModels.isNotEmpty()) {
                discoveredModels
            } else {
                OpenAiProvider.DEFAULT_MODELS
            }
            Column(
                verticalArrangement = Arrangement.spacedBy(5.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                openAiList.take(5).forEach { model ->
                    SelectableModelRow(
                        modelId = model.id,
                        subtitle = model.displayName,
                        selected = activeModel == model.id,
                        onClick = {
                            onUpdateSettings(settings.withUpdatedModelForActiveProvider(model.id))
                        }
                    )
                }
            }
        }

        "custom" -> {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                SectionHeaderLabel("ENDPOINT MODELS")
                Text(
                    text = if (isDiscoveringModels) "SYNCING…" else "↻ DISCOVER",
                    color = StarkCyan,
                    fontSize = 7.5.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .clickable(role = Role.Button, onClick = onDiscoverModels)
                        .padding(horizontal = 5.dp, vertical = 3.dp)
                )
            }
            if (discoveredModels.isNotEmpty()) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(5.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    discoveredModels.take(5).forEach { model ->
                        SelectableModelRow(
                            modelId = model.id,
                            subtitle = model.displayName,
                            selected = activeModel == model.id,
                            onClick = {
                                onUpdateSettings(settings.withUpdatedModelForActiveProvider(model.id))
                            }
                        )
                    }
                }
            }
        }
    }

    // 4. Manual Model ID Input
    SectionHeaderLabel("MANUAL MODEL ID")
    WatchTextFieldCard(
        value = activeModel,
        placeholder = when (settings.providerId.lowercase()) {
            "openai" -> "e.g. gpt-4o-mini or o3-mini"
            "custom" -> "e.g. openai/gpt-4o-mini"
            else -> "e.g. gemini-2.5-flash"
        },
        onValueChange = { typedModel ->
            onUpdateSettings(settings.withUpdatedModelForActiveProvider(typedModel))
        }
    )

    // 5. Encrypted Keystore API Key Field
    SectionHeaderLabel("API KEY · KEYSTORE ($maskedKeyPreview)")
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 44.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(DarkPanel)
            .border(0.9.dp, StarkCyan.copy(alpha = 0.45f), RoundedCornerShape(10.dp))
            .padding(horizontal = 9.dp, vertical = 6.dp)
    ) {
        Box(
            contentAlignment = Alignment.CenterStart,
            modifier = Modifier.weight(1f)
        ) {
            BasicTextField(
                value = apiKeyDraft,
                onValueChange = { apiKeyDraft = it },
                singleLine = true,
                textStyle = TextStyle(
                    color = HologramWhite,
                    fontSize = 8.8.sp,
                    fontFamily = FontFamily.Monospace
                ),
                cursorBrush = SolidColor(StarkCyan),
                visualTransformation = if (showKey) VisualTransformation.None else PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth()
            )
            if (apiKeyDraft.isEmpty()) {
                Text(
                    text = if (maskedKeyPreview == "UNSET") "Paste ${settings.providerId.uppercase()} API Key…" else "Saved ($maskedKeyPreview)",
                    color = MutedSlate,
                    fontSize = 8.2.sp
                )
            }
        }
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = if (showKey) "HIDE" else "SHOW",
            color = StarkCyan,
            fontSize = 7.8.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .clickable(role = Role.Button) { showKey = !showKey }
                .padding(horizontal = 5.dp, vertical = 3.dp)
        )
    }

    // 6. Save / Test Connection / Clear Actions with 44dp touch target heights
    Row(
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        TouchPillButton(
            label = "SAVE",
            selected = true,
            modifier = Modifier.weight(1f),
            onClick = {
                onUpdateSettings(settings)
                onSaveApiKey(apiKeyDraft.trim())
                apiKeyDraft = ""
            }
        )
        TouchPillButton(
            label = "TEST",
            selected = false,
            modifier = Modifier.weight(1f),
            onClick = {
                if (apiKeyDraft.isNotBlank()) {
                    onSaveApiKey(apiKeyDraft.trim())
                    apiKeyDraft = ""
                }
                onTestConnection()
            }
        )
        TouchPillButton(
            label = "CLEAR",
            selected = false,
            modifier = Modifier.weight(1f),
            onClick = {
                apiKeyDraft = ""
                onClearProviderCredentials()
            }
        )
    }

    if (connectionTestStatus.isNotBlank()) {
        Text(
            text = connectionTestStatus,
            color = if (connectionTestStatus.startsWith("Failed") || connectionTestStatus.contains("required", ignoreCase = true)) {
                StateErrorPrimary
            } else {
                StarkCyan
            },
            fontSize = 7.8.sp,
            lineHeight = 10.5.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 2.dp)
        )
    }

    // Contextual Destructive Action inside AI LINK only (never a permanent bottom-bar icon)
    TouchPillButton(
        label = if (confirmPurgeAll) "CONFIRM PURGE ALL KEYS?" else "PURGE ALL KEYSTORE KEYS",
        selected = false,
        modifier = Modifier.fillMaxWidth(),
        onClick = {
            if (!confirmPurgeAll) {
                confirmPurgeAll = true
            } else {
                apiKeyDraft = ""
                onClearAllCredentials()
                confirmPurgeAll = false
            }
        }
    )
}

@Composable
private fun SelectableModelRow(
    modelId: String,
    subtitle: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 44.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) StarkCyan.copy(alpha = 0.18f) else DarkPanel)
            .border(
                width = if (selected) 1.1.dp else 0.8.dp,
                color = if (selected) StarkCyan else StarkCyan.copy(alpha = 0.35f),
                shape = RoundedCornerShape(10.dp)
            )
            .clickable(role = Role.Button, onClick = onClick)
            .padding(horizontal = 9.dp, vertical = 6.dp)
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = modelId,
                color = if (selected) StarkCyan else HologramWhite,
                fontSize = 8.8.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (subtitle.isNotBlank() && !subtitle.equals(modelId, ignoreCase = true)) {
                Text(
                    text = subtitle,
                    color = MutedSlate,
                    fontSize = 7.2.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
        Icon(
            imageVector = if (selected) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
            contentDescription = if (selected) "Selected" else "Select model",
            tint = if (selected) StarkCyan else MutedSlate,
            modifier = Modifier.size(13.dp)
        )
    }
}

/**
 * Interactive Live Arc Reactor Theme Selector with 44dp touch target rows.
 */
@Composable
private fun ReactorSubScreen(
    settings: JarvisSettingsState,
    onUpdateSettings: (JarvisSettingsState) -> Unit
) {
    val themes = ReactorTheme.entries
    val currentTheme = ReactorTheme.fromId(settings.reactorThemeId)
    val currentIndex = themes.indexOf(currentTheme).coerceAtLeast(0)

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        CircularIconButton(
            icon = Icons.Default.ChevronLeft,
            contentDesc = "Previous Reactor Theme",
            sizeDp = 22.dp,
            touchTargetDp = 28.dp,
            onClick = {
                val prev = themes[(currentIndex - 1 + themes.size) % themes.size]
                onUpdateSettings(settings.copy(reactorThemeId = prev.id))
            }
        )

        ArcReactorCanvas(
            state = OperationalState.IDLE,
            theme = currentTheme,
            isAmbient = false,
            sizeDp = 50.dp
        )

        CircularIconButton(
            icon = Icons.Default.ChevronRight,
            contentDesc = "Next Reactor Theme",
            sizeDp = 22.dp,
            touchTargetDp = 28.dp,
            onClick = {
                val next = themes[(currentIndex + 1) % themes.size]
                onUpdateSettings(settings.copy(reactorThemeId = next.id))
            }
        )
    }

    Text(
        text = currentTheme.label,
        color = HologramWhite,
        fontSize = 9.2.sp,
        fontWeight = FontWeight.Bold
    )
    Text(
        text = currentTheme.subtitle,
        color = MutedSlate,
        fontSize = 7.8.sp
    )

    Column(
        verticalArrangement = Arrangement.spacedBy(5.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        themes.forEach { rt ->
            SelectableModelRow(
                modelId = rt.label,
                subtitle = rt.subtitle,
                selected = settings.reactorThemeId == rt.id,
                onClick = { onUpdateSettings(settings.copy(reactorThemeId = rt.id)) }
            )
        }
    }
}

/**
 * V5 Calibrated British Male Voice & Home Screen Captions Sub-Screen with 44dp touch targets.
 */
@Composable
private fun VoiceSubScreen(
    settings: JarvisSettingsState,
    availableVoices: List<WatchVoiceProfile>,
    activeVoiceSummary: String,
    onUpdateSettings: (JarvisSettingsState) -> Unit,
    onPreviewVoice: () -> Unit
) {
    // V5 Requirement 2: Optional Home-Screen Response Captions Setting
    SectionHeaderLabel("HOME SCREEN CAPTIONS")
    ToggleOptionRow(
        label = "Home Screen Captions",
        checked = settings.homeCaptionsEnabled,
        onLabel = "ENABLED",
        offLabel = "DISABLED",
        onToggle = { onUpdateSettings(settings.copy(homeCaptionsEnabled = it)) }
    )

    // V5 Requirement 7: Subtle Haptic Feedback Setting
    ToggleOptionRow(
        label = "Haptic Feedback",
        checked = settings.hapticsEnabled,
        onToggle = { onUpdateSettings(settings.copy(hapticsEnabled = it)) }
    )

    SectionHeaderLabel("ACCENT PREFERENCE")
    Row(
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        listOf("en-GB" to "British (UK)", "en-US" to "American (US)").forEach { (id, label) ->
            TouchPillButton(
                label = label,
                selected = settings.voiceAccent.equals(id, ignoreCase = true),
                modifier = Modifier.weight(1f),
                onClick = {
                    onUpdateSettings(settings.copy(voiceAccent = id, preferredVoiceName = ""))
                }
            )
        }
    }

    SectionHeaderLabel("SYSTEM VOICE SYNTHESIZER")
    val voiceOptions = remember(availableVoices) {
        listOf("" to "Auto British Male Default") + availableVoices.map { it.name to it.displayLabel }
    }
    val currentVoiceIdx = voiceOptions.indexOfFirst { it.first == settings.preferredVoiceName }.coerceAtLeast(0)

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 44.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(DarkPanel)
            .border(0.9.dp, StarkCyan.copy(alpha = 0.45f), RoundedCornerShape(10.dp))
            .clickable(role = Role.Button) {
                val nextIdx = (currentVoiceIdx + 1) % voiceOptions.size
                onUpdateSettings(settings.copy(preferredVoiceName = voiceOptions[nextIdx].first))
            }
            .padding(horizontal = 9.dp, vertical = 6.dp)
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = voiceOptions[currentVoiceIdx].second,
                color = HologramWhite,
                fontSize = 8.8.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = "Active: $activeVoiceSummary",
                color = StarkCyan.copy(alpha = 0.85f),
                fontSize = 7.2.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        Icon(
            imageVector = Icons.Default.Sync,
            contentDescription = "Cycle Installed Voice",
            tint = StarkCyan,
            modifier = Modifier.size(13.dp)
        )
    }

    SectionHeaderLabel("SPEECH SPEED (${String.format("%.2fx", settings.speechRate)})")
    Row(
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        listOf(0.9f, 1.0f, 1.1f, 1.2f).forEach { rate ->
            TouchPillButton(
                label = "${rate}x",
                selected = settings.speechRate == rate,
                modifier = Modifier.weight(1f),
                onClick = { onUpdateSettings(settings.copy(speechRate = rate)) }
            )
        }
    }

    SectionHeaderLabel("VOICE PITCH (${String.format("%.2f", settings.voicePitch)})")
    Row(
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        listOf(0.85f, 0.95f, 1.0f, 1.1f).forEach { pitch ->
            TouchPillButton(
                label = "$pitch",
                selected = settings.voicePitch == pitch,
                modifier = Modifier.weight(1f),
                onClick = { onUpdateSettings(settings.copy(voicePitch = pitch)) }
            )
        }
    }

    ToggleOptionRow(
        label = "Spoken TTS Replies",
        checked = settings.ttsEnabled,
        onToggle = { onUpdateSettings(settings.copy(ttsEnabled = it)) }
    )

    ToggleOptionRow(
        label = "Neural Cloud TTS (OpenAI)",
        checked = settings.neuralCloudTtsEnabled,
        onToggle = { onUpdateSettings(settings.copy(neuralCloudTtsEnabled = it)) }
    )

    TouchPillButton(
        label = "▶ PREVIEW VOICE",
        selected = true,
        modifier = Modifier.fillMaxWidth(),
        onClick = onPreviewVoice
    )
}

@Composable
private fun PersonaSubScreen(
    settings: JarvisSettingsState,
    onUpdateSettings: (JarvisSettingsState) -> Unit
) {
    SectionHeaderLabel("DEMEANOR PROFILE")
    val personas = listOf(
        Triple("stark_classic", "Stark Witty", "Refined British butler with dry wit"),
        Triple("tactical_hud", "Tactical HUD", "Concise combat & telemetry metrics"),
        Triple("formal_butler", "Formal Butler", "Polite executive protocol")
    )
    Column(
        verticalArrangement = Arrangement.spacedBy(5.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        personas.forEach { (id, title, desc) ->
            SelectableModelRow(
                modelId = title,
                subtitle = desc,
                selected = settings.personalityMode == id,
                onClick = { onUpdateSettings(settings.copy(personalityMode = id)) }
            )
        }
    }

    SectionHeaderLabel("CUSTOM DIRECTIVES")
    WatchTextFieldCard(
        value = settings.customSystemPrompt,
        placeholder = "e.g., Address me as Commander…",
        onValueChange = { onUpdateSettings(settings.copy(customSystemPrompt = it)) }
    )
}

@Composable
private fun MemorySubScreen(
    settings: JarvisSettingsState,
    messageCount: Int,
    onUpdateSettings: (JarvisSettingsState) -> Unit,
    onResetSuggestions: () -> Unit,
    onClearConversationMemory: () -> Unit
) {
    var confirmClear by remember { mutableStateOf(false) }

    SectionHeaderLabel("ACTIVE DIALOGUE TURNS · $messageCount")

    ToggleOptionRow(
        label = "Persistent Memory",
        checked = settings.memoryEnabled,
        onToggle = { onUpdateSettings(settings.copy(memoryEnabled = it)) }
    )
    ToggleOptionRow(
        label = "Adaptive Suggestions",
        checked = settings.suggestionsEnabled,
        onToggle = { onUpdateSettings(settings.copy(suggestionsEnabled = it)) }
    )

    TouchPillButton(
        label = "RESTORE SUGGESTIONS",
        selected = false,
        modifier = Modifier.fillMaxWidth(),
        onClick = onResetSuggestions
    )

    TouchPillButton(
        label = if (confirmClear) "CONFIRM CLEAR LOGS?" else "CLEAR CONVERSATION LOGS",
        selected = confirmClear,
        modifier = Modifier.fillMaxWidth(),
        onClick = {
            if (confirmClear) {
                onClearConversationMemory()
                confirmClear = false
            } else {
                confirmClear = true
            }
        }
    )
}

/**
 * V5 About Sub-Screen.
 * Displays:
 * - Application name: J.A.R.V.I.S.
 * - Creator: Furqan Siddiqui
 * - Short description: A personal AI assistant designed for Wear OS.
 * - GitHub profile: https://github.com/siddiqui-furqan (accessible link button on watch)
 * - Application version & build number: v5.0.0-SM-R860 · Build 5
 */
@Composable
private fun AboutSubScreen() {
    val context = LocalContext.current
    var linkStatus by remember { mutableStateOf("") }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(5.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(DarkPanel)
            .border(0.9.dp, StarkCyan.copy(alpha = 0.45f), RoundedCornerShape(12.dp))
            .padding(horizontal = 10.dp, vertical = 9.dp)
    ) {
        Text(
            text = "J.A.R.V.I.S.",
            color = StarkCyan,
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = 1.4.sp
        )
        Text(
            text = "An AI-powered personal assistant built natively for Wear OS.",
            color = HologramWhite,
            fontSize = 8.2.sp,
            lineHeight = 10.8.sp,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(2.dp))

        Text(
            text = "CREATOR",
            color = MutedSlate,
            fontSize = 6.5.sp,
            fontFamily = FontFamily.Monospace,
            letterSpacing = 1.sp
        )
        Text(
            text = "Furqan Siddiqui",
            color = HologramWhite,
            fontSize = 9.5.sp,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(2.dp))

        Text(
            text = "VERSION & BUILD",
            color = MutedSlate,
            fontSize = 6.5.sp,
            fontFamily = FontFamily.Monospace,
            letterSpacing = 1.sp
        )
        Text(
            text = "v6.0.0-SM-R860 · Build 6",
            color = StarkCyan.copy(alpha = 0.9f),
            fontSize = 7.8.sp,
            fontFamily = FontFamily.Monospace
        )
    }

    // Accessible 44dp touch target GitHub Profile Link Button
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 44.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(StarkCyan.copy(alpha = 0.16f))
            .border(1.dp, StarkCyan, RoundedCornerShape(10.dp))
            .clickable(role = Role.Button) {
                runCatching {
                    val uri = Uri.parse("https://github.com/siddiqui-furqan")
                    val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                        addCategory(Intent.CATEGORY_BROWSABLE)
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    context.startActivity(intent)
                    linkStatus = "Opening github.com/siddiqui-furqan…"
                }.onFailure {
                    linkStatus = "github.com/siddiqui-furqan"
                }
            }
            .padding(horizontal = 8.dp, vertical = 6.dp)
    ) {
        Icon(
            imageVector = Icons.Default.OpenInNew,
            contentDescription = "Open GitHub Profile",
            tint = StarkCyan,
            modifier = Modifier.size(11.dp)
        )
        Spacer(modifier = Modifier.width(5.dp))
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "GITHUB PROFILE",
                color = StarkCyan,
                fontSize = 8.2.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 0.6.sp
            )
            Text(
                text = "github.com/siddiqui-furqan",
                color = HologramWhite,
                fontSize = 7.2.sp,
                fontFamily = FontFamily.Monospace
            )
        }
    }

    if (linkStatus.isNotBlank()) {
        Text(
            text = linkStatus,
            color = StarkCyan,
            fontSize = 7.2.sp,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
private fun SectionHeaderLabel(text: String) {
    Text(
        text = text,
        style = JarvisTypography.TelemetryLabel,
        fontSize = 7.2.sp,
        textAlign = TextAlign.Center,
        modifier = Modifier.padding(top = 2.dp)
    )
}

@Composable
private fun WatchTextFieldCard(
    value: String,
    placeholder: String,
    onValueChange: (String) -> Unit
) {
    Box(
        contentAlignment = Alignment.CenterStart,
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 44.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(DarkPanel)
            .border(0.9.dp, StarkCyan.copy(alpha = 0.45f), RoundedCornerShape(10.dp))
            .padding(horizontal = 9.dp, vertical = 6.dp)
    ) {
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            textStyle = TextStyle(
                color = HologramWhite,
                fontSize = 8.8.sp,
                fontFamily = FontFamily.Monospace
            ),
            cursorBrush = SolidColor(StarkCyan),
            modifier = Modifier.fillMaxWidth()
        )
        if (value.isEmpty()) {
            Text(
                text = placeholder,
                color = MutedSlate,
                fontSize = 7.8.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun ToggleOptionRow(
    label: String,
    checked: Boolean,
    onLabel: String = "ON",
    offLabel: String = "OFF",
    onToggle: (Boolean) -> Unit
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 44.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(DarkPanel)
            .border(0.9.dp, StarkCyan.copy(alpha = 0.35f), RoundedCornerShape(10.dp))
            .clickable(role = Role.Button) { onToggle(!checked) }
            .padding(horizontal = 10.dp, vertical = 6.dp)
    ) {
        Text(
            text = label,
            color = HologramWhite,
            fontSize = 8.8.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.weight(1f)
        )
        Text(
            text = if (checked) onLabel else offLabel,
            color = if (checked) StarkCyan else MutedSlate,
            fontSize = 8.2.sp,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.ExtraBold
        )
    }
}

@Composable
private fun TouchPillButton(
    label: String,
    selected: Boolean = false,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .heightIn(min = 44.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) StarkCyan else DarkPanel)
            .border(0.9.dp, StarkCyan.copy(alpha = 0.55f), RoundedCornerShape(10.dp))
            .clickable(role = Role.Button, onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 5.dp)
    ) {
        Text(
            text = label,
            color = if (selected) ObsidianBlack else StarkCyan,
            fontSize = 8.2.sp,
            fontWeight = FontWeight.ExtraBold,
            textAlign = TextAlign.Center,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}
