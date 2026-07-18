import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  visible: boolean;
  titulo: string;
  texto: string;
  onClose: () => void;
};

export default function InfoModal({
  visible,
  titulo,
  texto,
  onClose,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.fondo}>

        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />

        <View style={styles.modal}>

          <View style={styles.linea} />

          <Text style={styles.titulo}>
            {titulo}
          </Text>

          <Text style={styles.texto}>
            {texto}
          </Text>

          <Pressable
            style={styles.boton}
            onPress={onClose}
          >
            <Text style={styles.textoBoton}>
              Entendido
            </Text>
          </Pressable>

        </View>

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  modal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
  },

  linea: {
    width: 55,
    height: 5,
    borderRadius: 20,
    backgroundColor: "#DDD",
    alignSelf: "center",
    marginBottom: 18,
  },

  titulo: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 15,
    color: "#111",
  },

  texto: {
    fontSize: 16,
    color: "#555",
    lineHeight: 24,
  },

  boton: {
    marginTop: 25,
    backgroundColor: "#5B8DB8",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },

  textoBoton: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});