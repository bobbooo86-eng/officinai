import { View, Text, StyleSheet } from 'react-native';
import { STATO_CONFIG, type AppuntamentoStato } from '@/lib/constants';

interface StatusBadgeProps {
  status: AppuntamentoStato;
  size?: 'small' | 'medium';
}

export default function StatusBadge({ status, size = 'small' }: StatusBadgeProps) {
  const config = STATO_CONFIG[status] || STATO_CONFIG.prenotato;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.bg },
        size === 'medium' && styles.badgeMedium,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: config.color },
          size === 'medium' && styles.textMedium,
        ]}
      >
        {config.icon} {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  badgeMedium: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  textMedium: {
    fontSize: 14,
  },
});
