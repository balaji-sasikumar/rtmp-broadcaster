import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Linking,
  PermissionsAndroid,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import RTMPPublisher, {
  type RTMPPublisherRefProps,
} from "react-native-rtmp-publisher";

// ─── Types ───────────────────────────────────────────────────────────────────

type ConnectionStatus =
  | "idle"
  | "connecting"
  | "live"
  | "disconnected"
  | "failed";

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  idle: "Ready to stream",
  connecting: "Connecting…",
  live: "Live",
  disconnected: "Disconnected",
  failed: "Connection failed",
};

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App(): React.JSX.Element {
  const publisherRef = useRef<RTMPPublisherRefProps>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [rtmpUrl, setRtmpUrl] = useState("rtmp://");
  const [streamKey, setStreamKey] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // ── Permissions ─────────────────────────────────────────────────────────────
  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS !== "android") {
      // iOS permissions are declared in Info.plist and requested by the
      // native RTMPPublisher component when the camera preview starts.
      return;
    }
    try {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]);
      const anyDenied = Object.values(result).some(
        (s) => s !== PermissionsAndroid.RESULTS.GRANTED,
      );
      if (anyDenied) {
        Alert.alert(
          "Permissions required",
          "Camera and microphone access are needed to stream live video.",
          [{ text: "OK" }],
        );
      }
    } catch (err) {
      console.error("[RTMPBroadcaster] Permission request error:", err);
    }
  };

  // ── Deep links ──────────────────────────────────────────────────────────────
  // Scheme: livestream://stream?url=<rtmpUrl>&key=<streamKey>
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) applyDeepLink(url);
    });

    const sub = Linking.addEventListener("url", ({ url }) =>
      applyDeepLink(url),
    );
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyDeepLink = (url: string) => {
    const urlMatch = url.match(/[?&]url=([^&]+)/);
    const keyMatch = url.match(/[?&]key=([^&]+)/);
    if (urlMatch?.[1]) setRtmpUrl(decodeURIComponent(urlMatch[1]));
    if (keyMatch?.[1]) setStreamKey(decodeURIComponent(keyMatch[1]));
  };

  // ── Pulsing LIVE badge animation ────────────────────────────────────────────
  useEffect(() => {
    if (!isStreaming) {
      pulseAnim.setValue(1);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.15,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [isStreaming, pulseAnim]);

  // ── Stream actions ──────────────────────────────────────────────────────────
  const handleGoLive = async () => {
    if (!rtmpUrl || rtmpUrl === "rtmp://" || !rtmpUrl.startsWith("rtmp")) {
      Alert.alert("Invalid RTMP URL", "Enter a valid rtmp:// URL.");
      return;
    }
    if (!streamKey.trim()) {
      Alert.alert("Missing stream key", "Please enter your stream key.");
      return;
    }
    setErrorMessage("");
    setConnectionStatus("connecting");
    try {
      await publisherRef.current?.startStream();
    } catch (err) {
      setConnectionStatus("failed");
      setErrorMessage("Failed to start stream. Check URL and key.");
    }
  };

  const handleStop = async () => {
    try {
      await publisherRef.current?.stopStream();
    } catch (err) {
      console.error("[RTMPBroadcaster] stopStream error:", err);
    }
  };

  const handleToggleMute = async () => {
    try {
      if (isMuted) {
        await publisherRef.current?.unmute();
      } else {
        await publisherRef.current?.mute();
      }
      setIsMuted((prev) => !prev);
    } catch (err) {
      console.error("[RTMPBroadcaster] mute toggle error:", err);
    }
  };

  const handleSwitchCamera = async () => {
    try {
      await publisherRef.current?.switchCamera();
    } catch (err) {
      console.error("[RTMPBroadcaster] switchCamera error:", err);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Full-screen camera preview */}
      <RTMPPublisher
        ref={publisherRef}
        style={StyleSheet.absoluteFill}
        streamURL={rtmpUrl}
        streamName={streamKey}
        onConnectionStarted={() => setConnectionStatus("connecting")}
        onConnectionSuccess={() => {
          setIsStreaming(true);
          setConnectionStatus("live");
          setErrorMessage("");
        }}
        onConnectionFailed={() => {
          setIsStreaming(false);
          setConnectionStatus("failed");
          setErrorMessage(
            "Could not connect to stream server. Check your URL and key.",
          );
        }}
        onDisconnect={() => {
          setIsStreaming(false);
          setConnectionStatus("disconnected");
        }}
      />

      {/* Top row: mute (left) | camera switch (right) */}
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleToggleMute}
          accessibilityLabel={isMuted ? "Unmute microphone" : "Mute microphone"}
          accessibilityRole="button"
        >
          <Text style={styles.iconButtonText}>{isMuted ? "🔇" : "🎤"}</Text>
        </TouchableOpacity>

        <View style={styles.topRowSpacer} />

        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleSwitchCamera}
          accessibilityLabel="Switch camera"
          accessibilityRole="button"
        >
          <Text style={styles.iconButtonText}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* LIVE badge — visible only when streaming */}
      {isStreaming ? (
        <View style={styles.liveBadge} pointerEvents="none">
          <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>
      ) : null}

      {/* Bottom overlay */}
      <KeyboardAvoidingView
        style={styles.bottomOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Connection status */}
        <Text
          style={[
            styles.statusText,
            connectionStatus === "live" && styles.statusLive,
            connectionStatus === "failed" && styles.statusFailed,
            connectionStatus === "connecting" && styles.statusConnecting,
          ]}
        >
          {STATUS_LABEL[connectionStatus]}
        </Text>

        {/* Error message */}
        {errorMessage !== "" ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}

        {/* RTMP URL input */}
        <TextInput
          style={[styles.input, isStreaming && styles.inputDisabled]}
          placeholder="RTMP URL  (rtmp://server/live)"
          placeholderTextColor="#888"
          value={rtmpUrl}
          onChangeText={setRtmpUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={!isStreaming}
          accessibilityLabel="RTMP URL"
        />

        {/* Stream key input */}
        <TextInput
          style={[styles.input, isStreaming && styles.inputDisabled]}
          placeholder="Stream Key"
          placeholderTextColor="#888"
          value={streamKey}
          onChangeText={setStreamKey}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          editable={!isStreaming}
          accessibilityLabel="Stream key"
        />

        {/* Go Live / Stop button */}
        <TouchableOpacity
          style={[styles.liveButton, isStreaming && styles.stopButton]}
          onPress={isStreaming ? handleStop : handleGoLive}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={isStreaming ? "Stop stream" : "Go live"}
        >
          <Text style={styles.liveButtonText}>
            {isStreaming ? "■  Stop" : "⏺  Go Live"}
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const TOP_OFFSET = Platform.OS === "ios" ? 56 : 36;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },

  // ── Top controls ────────────────────────────────────────────────────────────
  topRow: {
    position: "absolute",
    top: TOP_OFFSET,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  topRowSpacer: {
    flex: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  iconButtonText: {
    fontSize: 20,
  },

  // ── LIVE badge ───────────────────────────────────────────────────────────────
  liveBadge: {
    position: "absolute",
    top: TOP_OFFSET,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
  liveBadgeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 1.5,
  },

  // ── Bottom overlay ───────────────────────────────────────────────────────────
  bottomOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
    backgroundColor: "rgba(0,0,0,0.68)",
    gap: 10,
  },

  // Status
  statusText: {
    color: "#aaa",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 2,
  },
  statusLive: {
    color: "#4ade80",
    fontWeight: "600",
  },
  statusFailed: {
    color: "#f87171",
  },
  statusConnecting: {
    color: "#facc15",
  },

  // Error
  errorText: {
    color: "#f87171",
    fontSize: 12,
    textAlign: "center",
    marginTop: -4,
  },

  // Inputs
  input: {
    backgroundColor: "rgba(255,255,255,0.13)",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 13 : 10,
    color: "#fff",
    fontSize: 14,
  },
  inputDisabled: {
    opacity: 0.45,
  },

  // Go Live / Stop button
  liveButton: {
    backgroundColor: "#22c55e",
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 2,
  },
  stopButton: {
    backgroundColor: "#ef4444",
  },
  liveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});
