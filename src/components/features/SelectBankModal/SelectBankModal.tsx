'use client';

import {
  Modal,
  Stack,
  Button,
  Group,
  Text,
  Title,
  Badge,
  SimpleGrid,
  Card,
  ThemeIcon,
  Center,
  Loader,
} from '@mantine/core';
import { IconBuildingBank, IconCheck } from '@tabler/icons-react';
import { useGetSupportedBanksQuery, SupportedBank } from '@/lib/store/api/BankApi';

interface SelectBankModalProps {
  opened: boolean;
  onClose: () => void;
  onBankSelect: (bankId: SupportedBank, bankName: string) => void;
}

const BANK_INFO: Record<SupportedBank, { name: string; color: string }> = {
  abank: { name: 'Альфа-Банк', color: '#ef4444' },
  vbank: { name: 'ВТБ', color: '#667eea' },
  sbank: { name: 'Сбербанк', color: '#4facfe' },
};

export function SelectBankModal({ opened, onClose, onBankSelect }: SelectBankModalProps) {
  const { data: response, isLoading, error } = useGetSupportedBanksQuery();

  // Extract banks array from response: { banks: [...] }
  const banksArray = response?.banks && Array.isArray(response.banks) ? response.banks : [];

  const handleBankClick = (bankId: SupportedBank) => {
    const bankInfo = BANK_INFO[bankId];
    onBankSelect(bankId, bankInfo.name);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconBuildingBank size={24} />
          <Title order={4}>Выберите банк для подключения</Title>
        </Group>
      }
      size="md"
      centered
    >
      <Stack gap="md">
        {isLoading ? (
          <Center py="xl">
            <Loader size="md" />
          </Center>
        ) : error ? (
          <Text c="red" size="sm">
            Ошибка при загрузке списка банков
          </Text>
        ) : !banksArray || banksArray.length === 0 ? (
          <Text c="dimmed" size="sm">
            Нет доступных банков для подключения
          </Text>
        ) : (
          <SimpleGrid cols={1} spacing="sm">
            {banksArray.map((bankId) => {
              const bankInfo = BANK_INFO[bankId];
              return (
                <Card
                  key={bankId}
                  padding="md"
                  radius="md"
                  style={{
                    border: `1px solid ${bankInfo.color}30`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${bankInfo.color}10`;
                    e.currentTarget.style.borderColor = bankInfo.color;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = `${bankInfo.color}30`;
                  }}
                  onClick={() => handleBankClick(bankId)}
                >
                  <Group justify="space-between">
                    <Group gap="md">
                      <ThemeIcon
                        size={40}
                        radius="md"
                        style={{
                          background: `${bankInfo.color}15`,
                          border: `1px solid ${bankInfo.color}30`,
                        }}
                      >
                        <IconBuildingBank size={20} color={bankInfo.color} />
                      </ThemeIcon>
                      <div>
                        <Text fw={600} size="sm">
                          {bankInfo.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {bankId}
                        </Text>
                      </div>
                    </Group>
                    <IconCheck size={20} color={bankInfo.color} style={{ opacity: 0.5 }} />
                  </Group>
                </Card>
              );
            })}
          </SimpleGrid>
        )}
      </Stack>
    </Modal>
  );
}

