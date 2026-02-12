import { StyleSheet } from "react-native";
import { Text, View } from "@/components/Themed";
import { useAuth } from "@/contexts/AuthContext";

export default function OrdersScreen() {
  const { user } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Bonjour, {user?.name || "Commerçant"}</Text>
      <Text style={styles.title}>Commandes</Text>
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Aucune commande en cours</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  greeting: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 24,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.5,
  },
});
