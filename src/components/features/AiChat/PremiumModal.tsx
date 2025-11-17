'use client';

import { Modal, Button, Stack, Text, Group, List, ThemeIcon, Box } from '@mantine/core';
import { IconCrown, IconCheck, IconSparkles } from '@tabler/icons-react';

interface PremiumModalProps {
  opened: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

export function PremiumModal({ opened, onClose, onUpgrade }: PremiumModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconCrown size={24} color="#FFD700" />
          <Text fw={700} size="lg">Премиум подписка</Text>
        </Group>
      }
      centered
      size="md"
    >
      <Stack gap="lg">
        <Box
          p="md"
          style={{
            background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
            borderRadius: '8px',
          }}
        >
          <Text fw={600} size="sm" c="white" ta="center">
            Получите неограниченный доступ к AI ассистенту!
          </Text>
        </Box>

        <Text size="sm" c="dimmed">
          Премиум подписка открывает полный доступ ко всем возможностям Иван Банкова:
        </Text>

        <List
          spacing="sm"
          size="sm"
          icon={
            <ThemeIcon color="blue" size={20} radius="xl">
              <IconCheck size={12} />
            </ThemeIcon>
          }
        >
          <List.Item>
            <Text fw={500}>Неограниченное количество вопросов</Text>
          </List.Item>
          <List.Item>
            <Text fw={500}>Приоритетная обработка запросов</Text>
          </List.Item>
          <List.Item>
            <Text fw={500}>Расширенный анализ финансов</Text>
          </List.Item>
          <List.Item>
            <Text fw={500}>Персональные рекомендации</Text>
          </List.Item>
          <List.Item>
            <Text fw={500}>Эксклюзивные функции</Text>
          </List.Item>
        </List>

        <Group justify="space-between" mt="md">
          <Button variant="subtle" onClick={onClose}>
            Позже
          </Button>
          <Button
            leftSection={<IconSparkles size={18} />}
            onClick={onUpgrade}
            variant="gradient"
            gradient={{ from: '#FFD700', to: '#FFA500' }}
          >
            Приобрести Premium
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

