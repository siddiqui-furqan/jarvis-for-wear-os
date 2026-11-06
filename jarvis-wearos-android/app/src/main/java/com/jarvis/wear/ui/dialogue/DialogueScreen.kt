package com.jarvis.wear.ui.dialogue

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.rotary.onRotaryScrollEvent
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material3.Icon
import androidx.wear.compose.material3.Text
import com.jarvis.wear.RotaryScrollEvent
import com.jarvis.wear.data.database.MessageEntity
import com.jarvis.wear.ui.components.CircularBezelTelemetryOverlay
import com.jarvis.wear.ui.components.CircularScreenHeader
import com.jarvis.wear.ui.components.CurvedOrbitalActionDock
import com.jarvis.wear.ui.components.rememberCircularResponsiveSpec
import com.jarvis.wear.ui.theme.*
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

/**
 * JARVIS V5 Circular Holographic Dialogue Screen calibrated for the 198dp x 198dp (396x396px)
 * Samsung Galaxy Watch 4 circular viewport.
 * Explicitly accessible from the Home screen Dialogue navigation button, with deduplicated rotary
 * bezel scrolling, subtle haptics, dedicated typed-message input (decoupled from speech recognition),
 * and unified `CurvedOrbitalActionDock`.
 */
@Composable
fun DialogueScreen(
    messages: List<MessageEntity>,
    state: OperationalState,
    isSpeaking: Boolean,
    liveTranscript: String,
    pendingConfirmationPrompt: String? = null,
    rotaryEvents: SharedFlow<RotaryScrollEvent>,
    onRotaryTick: () -> Unit = {},
    onBack: () -> Unit,
    onFollowUpVoice: () -> Unit,
    onCancelVoiceListening: () -> Unit = {},
    onSubmitQuery: (String) -> Unit,
    onConfirmDeviceAction: () -> Unit = {},
    onCancelDeviceAction: () -> Unit = {},
    onReplayAudio: (String) -> Unit,
    onStopAudio: () -> Unit,
    onClearHistory: () -> Unit
) {
    val listState = rememberLazyListState()
    val coroutineScope = rememberCoroutineScope()
    val focusRequester = remember { FocusRequester() }
    val focusManager = LocalFocusManager.current
    val keyboardController = LocalSoftwareKeyboardController.current
    var confirmClear by remember { mutableStateOf(false) }
    var typedMessage by remember { mutableStateOf("") }
    var lastRotaryHandledMs by remember { mutableLongStateOf(0L) }

    val submitTypedInput = {
        val clean = typedMessage.trim()
        if (clean.isNotEmpty()) {
            typedMessage = ""
            keyboardController?.hide()
            focusManager.clearFocus()
            onSubmitQuery(clean)
        }
    }

    // Scroll to newest message when messages update
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    // Subscribe to custom WearableActivity.onRotaryEvent bezel events (with 25ms deduplication against Compose rotary)
    LaunchedEffect(rotaryEvents) {
        rotaryEvents.collect { rotary ->
            val now = System.currentTimeMillis()
            if (now - lastRotaryHandledMs >= 25L) {
                lastRotaryHandledMs = now
                onRotaryTick()
                listState.scrollBy(rotary.deltaPx)
            }
        }
    }

    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
    }

    val canScrollDown by remember {
        derivedStateOf { listState.canScrollForward }
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
                        listState.scrollBy(event.verticalScrollPixels)
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
            // 1. Top Curved Navigation Dock with symmetric 3-slot layout
            CircularScreenHeader(
                title = "DIALOGUE",
                badgeCount = messages.size,
                rightActionLabel = if (confirmClear) "CONFIRM?" else "CLEAR",
                onBack = onBack,
                onRightAction = {
                    if (confirmClear) {
                        onClearHistory()
                        confirmClear = false
                    } else {
                        confirmClear = true
                    }
                },
                spec = spec
            )

            // 2. Holographic Conversational Stream (No rectangular boxes)
            LazyColumn(
                state = listState,
                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 6.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .weight(1f)
                    .width(spec.contentSafeWidthDp.dp)
            ) {
                if (messages.isEmpty()) {
                    item {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.padding(top = 18.dp, start = 12.dp, end = 12.dp)
                        ) {
                            Text(
                                text = "CHANNEL STANDBY",
                                color = StarkCyan,
                                fontSize = 8.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.2.sp
                            )
                            Spacer(modifier = Modifier.height(3.dp))
                            Text(
                                text = "Type a message below or tap FOLLOW UP to speak with J.A.R.V.I.S., sir.",
                                color = MutedSlate,
                                fontSize = 7.8.sp,
                                lineHeight = 10.5.sp,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                } else {
                    itemsIndexed(messages, key = { _, m -> m.id }) { idx, msg ->
                        DialogueEntryBlock(
                            message = msg,
                            showTopArc = idx > 0,
                            isSpeaking = isSpeaking && idx == messages.lastIndex && msg.role == "assistant",
                            onReplayAudio = { onReplayAudio(msg.content) },
                            onStopAudio = onStopAudio
                        )
                    }
                }

                if (!pendingConfirmationPrompt.isNullOrBlank()) {
                    item {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(5.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(DarkPanel)
                                .border(1.dp, StarkCyan, RoundedCornerShape(10.dp))
                                .padding(horizontal = 8.dp, vertical = 6.dp)
                        ) {
                            Text(
                                text = pendingConfirmationPrompt,
                                color = HologramWhite,
                                fontSize = 7.8.sp,
                                textAlign = TextAlign.Center
                            )
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Box(
                                    contentAlignment = Alignment.Center,
                                    modifier = Modifier
                                        .weight(1f)
                                        .heightIn(min = 42.dp)
                                        .clip(RoundedCornerShape(9.dp))
                                        .background(StarkCyan)
                                        .clickable(role = Role.Button, onClick = onConfirmDeviceAction)
                                ) {
                                    Text(
                                        text = "CONFIRM",
                                        color = ObsidianBlack,
                                        fontSize = 8.sp,
                                        fontWeight = FontWeight.ExtraBold
                                    )
                                }
                                Box(
                                    contentAlignment = Alignment.Center,
                                    modifier = Modifier
                                        .weight(1f)
                                        .heightIn(min = 42.dp)
                                        .clip(RoundedCornerShape(9.dp))
                                        .background(StateErrorPrimary.copy(alpha = 0.2f))
                                        .border(0.8.dp, StateErrorPrimary, RoundedCornerShape(9.dp))
                                        .clickable(role = Role.Button, onClick = onCancelDeviceAction)
                                ) {
                                    Text(
                                        text = "CANCEL",
                                        color = StateErrorPrimary,
                                        fontSize = 8.sp,
                                        fontWeight = FontWeight.ExtraBold
                                    )
                                }
                            }
                        }
                    }
                }

                if (state == OperationalState.PROCESSING) {
                    item {
                        Text(
                            text = "Synthesizing response, sir…",
                            color = StateProcessingPrimary,
                            fontSize = 7.5.sp,
                            fontFamily = FontFamily.Monospace,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(vertical = 4.dp)
                        )
                    }
                }

                if (state == OperationalState.LISTENING) {
                    item {
                        Text(
                            text = if (liveTranscript.isNotBlank()) "“$liveTranscript”" else "Receiving Voice Input…",
                            color = StarkCyan,
                            fontSize = 7.5.sp,
                            fontFamily = FontFamily.Monospace,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(vertical = 2.dp)
                        )
                    }
                }

                // Dedicated Typed-Message Composer (Always available in Dialogue without starting SpeechRecognizer)
                item {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        modifier = Modifier
                            .width(136.dp)
                            .heightIn(min = 24.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(DarkPanel)
                            .border(0.8.dp, StarkCyan.copy(alpha = 0.7f), RoundedCornerShape(12.dp))
                            .padding(horizontal = 7.dp, vertical = 3.dp)
                    ) {
                        Box(
                            contentAlignment = Alignment.CenterStart,
                            modifier = Modifier.weight(1f)
                        ) {
                            if (typedMessage.isEmpty()) {
                                Text(
                                    text = "Type message…",
                                    color = MutedSlate,
                                    fontSize = 6.8.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                            BasicTextField(
                                value = typedMessage,
                                onValueChange = { typedMessage = it },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                                keyboardActions = KeyboardActions(
                                    onSend = { submitTypedInput() },
                                    onDone = { submitTypedInput() },
                                    onGo = { submitTypedInput() }
                                ),
                                textStyle = TextStyle(
                                    color = HologramWhite,
                                    fontSize = 6.8.sp,
                                    fontFamily = FontFamily.Monospace
                                ),
                                cursorBrush = SolidColor(StarkCyan),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .onFocusChanged { focusState ->
                                        if (focusState.isFocused && state == OperationalState.LISTENING) {
                                            // Ensure microphone is stopped if user switches to typing
                                            onCancelVoiceListening()
                                        }
                                    }
                            )
                        }
                        Text(
                            text = "SEND",
                            color = ObsidianBlack,
                            fontSize = 6.sp,
                            fontWeight = FontWeight.ExtraBold,
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(StarkCyan)
                                .clickable(role = Role.Button) {
                                    submitTypedInput()
                                }
                                .padding(horizontal = 5.dp, vertical = 2.dp)
                        )
                    }
                }
            }

            // 3. Unified V5 Curved Orbital Action Dock along the lower circular circumference
            val isListening = state == OperationalState.LISTENING
            val hasTypedText = typedMessage.trim().isNotEmpty()
            CurvedOrbitalActionDock(
                leftIcon = Icons.Default.Refresh,
                leftContentDesc = "Return to Reactor",
                onLeftClick = onBack,
                centerIcon = if (hasTypedText) Icons.Default.Send else Icons.Default.Mic,
                centerLabel = when {
                    hasTypedText -> "SEND TEXT"
                    isListening -> "LISTENING"
                    else -> "FOLLOW UP"
                },
                centerBackgroundColor = if (isListening && !hasTypedText) StateErrorPrimary else StarkCyan,
                centerContentColor = if (isListening && !hasTypedText) HologramWhite else ObsidianBlack,
                onCenterClick = {
                    if (hasTypedText) {
                        submitTypedInput()
                    } else {
                        onFollowUpVoice()
                    }
                },
                rightIcon = if (isSpeaking) {
                    Icons.Default.VolumeOff
                } else if (canScrollDown) {
                    Icons.Default.KeyboardArrowDown
                } else {
                    Icons.Default.KeyboardArrowUp
                },
                rightContentDesc = if (isSpeaking) {
                    "Stop Speech"
                } else if (canScrollDown) {
                    "Scroll Down"
                } else {
                    "Scroll Up"
                },
                rightTint = if (isSpeaking) StateErrorPrimary else StarkCyan,
                rightBorderColor = if (isSpeaking) StateErrorPrimary.copy(alpha = 0.7f) else StarkCyan.copy(alpha = 0.5f),
                onRightClick = {
                    if (isSpeaking) {
                        onStopAudio()
                    } else {
                        coroutineScope.launch {
                            listState.scrollBy(if (canScrollDown) 68f else -68f)
                        }
                    }
                },
                spec = spec
            )
        }
    }
}

@Composable
private fun DialogueEntryBlock(
    message: MessageEntity,
    showTopArc: Boolean,
    isSpeaking: Boolean,
    onReplayAudio: () -> Unit,
    onStopAudio: () -> Unit
) {
    val isAssistant = message.role == "assistant"
    val arcPath = remember { Path() }
    val timeFmt = remember(message.timestamp) {
        SimpleDateFormat("hh:mm a", Locale.US).format(Date(message.timestamp))
    }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .widthIn(max = 132.dp)
            .fillMaxWidth()
    ) {
        if (showTopArc && isAssistant) {
            Canvas(
                modifier = Modifier
                    .width(88.dp)
                    .height(4.dp)
                    .padding(bottom = 2.dp)
            ) {
                arcPath.rewind()
                arcPath.moveTo(4f, size.height - 0.5f)
                arcPath.quadraticBezierTo(size.width / 2f, 0.5f, size.width - 4f, size.height - 0.5f)
                drawPath(
                    path = arcPath,
                    color = StarkCyan.copy(alpha = 0.35f),
                    style = Stroke(width = 0.6.dp.toPx(), cap = StrokeCap.Round)
                )
                drawCircle(
                    color = StarkCyan,
                    radius = 1.dp.toPx(),
                    center = Offset(size.width / 2f, size.height * 0.45f)
                )
            }
        }

        // Metadata Line
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(3.dp)
        ) {
            Text(
                text = if (isAssistant) "J.A.R.V.I.S." else "VOICE INPUT",
                color = if (isAssistant) StarkCyan else StarkCyan.copy(alpha = 0.75f),
                fontSize = 6.2.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.8.sp
            )
            Text(
                text = "·",
                color = MutedSlate,
                fontSize = 6.2.sp
            )
            Text(
                text = timeFmt,
                color = MutedSlate,
                fontSize = 6.2.sp,
                fontFamily = FontFamily.Monospace
            )
        }

        Spacer(modifier = Modifier.height(2.dp))

        // Readable Holographic Message Text
        Text(
            text = if (isAssistant) message.content else "“${message.content}”",
            color = if (isAssistant) HologramWhite else StarkCyan.copy(alpha = 0.92f),
            fontSize = if (isAssistant) 8.5.sp else 7.8.sp,
            fontStyle = if (isAssistant) FontStyle.Normal else FontStyle.Italic,
            lineHeight = 11.5.sp,
            textAlign = TextAlign.Center
        )

        if (isAssistant) {
            Spacer(modifier = Modifier.height(2.5.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(3.dp),
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .clickable(role = Role.Button) {
                        if (isSpeaking) onStopAudio() else onReplayAudio()
                    }
                    .padding(horizontal = 5.dp, vertical = 2.dp)
            ) {
                Icon(
                    imageVector = if (isSpeaking) Icons.Default.VolumeOff else Icons.Default.VolumeUp,
                    contentDescription = if (isSpeaking) "Stop Audio" else "Replay Audio",
                    tint = if (isSpeaking) StateErrorPrimary else StarkCyan,
                    modifier = Modifier.size(8.dp)
                )
                Text(
                    text = if (isSpeaking) "Stop" else "Replay Audio",
                    color = if (isSpeaking) StateErrorPrimary else StarkCyan,
                    fontSize = 6.8.sp,
                    fontFamily = FontFamily.Monospace
                )
            }
        }
    }
}
