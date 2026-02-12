import { StyleSheet, TouchableOpacity } from "react-native";
import { Text, View } from "@/components/Themed";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Paramètres</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Nom</Text>
        <Text style={styles.value}>{user?.name || "—"}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email || "—"}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Rôle</Text>
        <Text style={styles.value}>{user?.role || "—"}</Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>
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
    marginBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    opacity: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
  },
  logoutButton: {
    marginTop: "auto",
    marginBottom: 32,
    height: 50,
    backgroundColor: "#dc2626",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
