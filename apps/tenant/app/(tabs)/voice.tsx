import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";

import { Text, View } from "@/components/Themed";

export default function VoiceScreen() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [partialTranscript, setPartialTranscript] = useState("");

  useSpeechRecognitionEvent("start", () => {
    setIsListening(true);
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
    setPartialTranscript("");
  });

  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results[0]?.transcript ?? "";
    if (event.isFinal) {
      setTranscript((prev) => (prev ? `${prev}\n${text}` : text));
      setPartialTranscript("");
    } else {
      setPartialTranscript(text);
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    setIsListening(false);
    if (event.error !== "no-speech") {
      Alert.alert("Erreur", event.message || "Erreur de reconnaissance vocale");
    }
  });

  async function toggleListening() {
    if (isListening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }

    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) {
      Alert.alert(
        "Permission requise",
        "Autorisez l'accès au microphone pour utiliser cette fonctionnalité.",
      );
      return;
    }

    setPartialTranscript("");
    ExpoSpeechRecognitionModule.start({
      lang: "fr-FR",
      interimResults: true,
      continuous: true,
    });
  }

  function handleClear() {
    setTranscript("");
    setPartialTranscript("");
  }

  const displayText = partialTranscript
    ? transcript
      ? `${transcript}\n${partialTranscript}`
      : partialTranscript
    : transcript;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dictée vocale</Text>

      <ScrollView
        style={styles.transcriptBox}
        contentContainerStyle={styles.transcriptContent}
      >
        {displayText ? (
          <>
            <Text style={styles.transcriptText}>{transcript}</Text>
            {partialTranscript ? (
              <Text style={styles.partialText}>{partialTranscript}</Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.placeholderText}>
            Appuyez sur le micro pour commencer...
          </Text>
        )}
      </ScrollView>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.micButton, isListening && styles.micButtonActive]}
          onPress={toggleListening}
          activeOpacity={0.7}
        >
          {isListening ? (
            <View style={styles.micInner}>
              <View style={styles.stopIcon} />
            </View>
          ) : (
            <Text style={styles.micIcon}>🎙</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.statusText}>
          {isListening ? "Écoute en cours..." : "Appuyez pour parler"}
        </Text>

        {transcript ? (
          <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
            <Text style={styles.clearButtonText}>Effacer</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 16,
  },
  transcriptBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    backgroundColor: "#1a1a1a",
  },
  transcriptContent: {
    padding: 16,
    flexGrow: 1,
  },
  transcriptText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#fff",
  },
  partialText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#888",
    fontStyle: "italic",
  },
  placeholderText: {
    fontSize: 16,
    opacity: 0.4,
    textAlign: "center",
    marginTop: 40,
  },
  controls: {
    alignItems: "center",
    paddingVertical: 24,
    backgroundColor: "transparent",
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
  },
  micButtonActive: {
    backgroundColor: "#dc2626",
  },
  micInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  stopIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  micIcon: {
    fontSize: 32,
  },
  statusText: {
    marginTop: 12,
    fontSize: 14,
    opacity: 0.6,
  },
  clearButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#555",
  },
  clearButtonText: {
    color: "#aaa",
    fontSize: 14,
  },
});
