'use client';

import {
  Modal,
  Stack,
  TextInput,
  Button,
  Group,
  Text,
  Alert,
  Title,
  Badge,
} from '@mantine/core';
import { IconAlertCircle, IconBuildingBank, IconCheck } from '@tabler/icons-react';
import { useState } from 'react';
import { useConnectBankMutation, SupportedBank } from '@/lib/store/api/BankApi';
import { notifications } from '@mantine/notifications';

interface ConnectBankModalProps {
  opened: boolean;
  onClose: () => void;
  bankId: SupportedBank;
  bankName: string;
}

const BANK_NAMES: Record<SupportedBank, string> = {
  abank: 'Альфа-Банк',
  vbank: 'ВТБ',
  sbank: 'Сбербанк',
};

export function ConnectBankModal({ opened, onClose, bankId, bankName }: ConnectBankModalProps) {
  const [clientId, setClientId] = useState('team052-2');
  const [error, setError] = useState<string | null>(null);
  const [connectBank, { isLoading }] = useConnectBankMutation();

  const handleConnect = async () => {
    if (!clientId.trim()) {
      setError('Пожалуйста, введите client_id');
      return;
    }

    setError(null);

    try {
      const result = await connectBank({ bankId, client_id: clientId.trim() }).unwrap();
      
      notifications.show({
        title: 'Успешно!',
        message: `Банк ${bankName} успешно подключен`,
        color: 'green',
        icon: <IconCheck size={18} />,
      });

      onClose();
      setClientId('team052-2'); // Reset to default
    } catch (err: any) {
      const errorMessage = err?.data?.message || err?.message || 'Произошла ошибка при подключении банка';
      setError(errorMessage);
      
      notifications.show({
        title: 'Ошибка',
        message: errorMessage,
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    }
  };

  const handleClose = () => {
    setError(null);
    setClientId('team052-2');
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="sm">
          <IconBuildingBank size={24} />
          <Title order={4}>Подключение банка</Title>
        </Group>
      }
      size="md"
      centered
    >
      <Stack gap="md">
        <div>
          <Text size="sm" c="dimmed" mb="xs">
            Вы подключаете:
          </Text>
          <Badge size="lg" variant="light" color="blue" leftSection={<IconBuildingBank size={16} />}>
            {bankName}
          </Badge>
        </div>

        <Text size="sm" c="dimmed">
          Для подключения банка необходимо указать ваш <strong>client_id</strong>. 
          Это идентификатор вашего приложения в системе банка.
        </Text>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="Ошибка" color="red">
            {error}
          </Alert>
        )}

        <TextInput
          label="Client ID"
          placeholder="team052-2"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          description="Введите ваш client_id (например: team052-1, team052-2, ..., team052-5)"
          required
          disabled={isLoading}
        />

        <Group justify="flex-end" gap="sm" mt="md">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Отмена
          </Button>
          <Button onClick={handleConnect} loading={isLoading}>
            Подключить
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}



