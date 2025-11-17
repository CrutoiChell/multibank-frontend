'use client';

import { Container, Grid, Loader, Center, Alert, Stack, Title, Text, Button, Group, Card, Divider } from '@mantine/core';
import { useState } from 'react';
import { useGetBankOverviewQuery, useGetTransactionsStatisticsQuery } from '@/lib/store/api/AuthApi';
import { useGetCurrentUserQuery } from '@/lib/store/api/UserApi';
import BalanceAnalytics from "./balanceAnalytics/BalanceAnalytics";
import DonutChart from './donutChart/DonutChart';
import Cards from "./cards/Cards";
import styles from './page.module.css';
import Link from 'next/link';

export default function AnalyticsPage() {
  const { isLoading: authLoading, isSuccess: authOk } = useGetCurrentUserQuery();
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  
  const { data: accountsData, isLoading: accountsLoading, error: accountsError } = useGetBankOverviewQuery({});
  const { data: statisticsData, isLoading: statisticsLoading, error: statisticsError } = useGetTransactionsStatisticsQuery();

  const selectedBank = selectedBankId || (accountsData?.banks && accountsData.banks.length > 0 ? accountsData.banks[0].bankId : null);

  const handleCardChange = (bankId: string) => {
    setSelectedBankId(bankId);
  };

  if (authLoading) {
    return (
      <Container size="xl" py="xl">
        <Center h={400}>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text c="dimmed" size="sm">Загрузка...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  if (!authOk && !authLoading) {
    return (
      <Container size="xl" py="xl">
        <Center h={"70dvh"}>
          <Stack align="center" gap="md">
            <Title order={2} fw={600}>Пожалуйста, авторизуйтесь</Title>
            <Text c="dimmed" size="sm">Для доступа к аналитике нужен вход в систему</Text>
            <Group gap="sm" mt="md">
              <Button component={Link as any} href="/login" size="md">Войти</Button>
              <Button variant="light" component={Link as any} href="/registration" size="md">Регистрация</Button>
            </Group>
          </Stack>
        </Center>
      </Container>
    );
  }

  const isLoading = accountsLoading || statisticsLoading;
  const hasError = accountsError || statisticsError;

  return (
    <Container size="xl" py="xl" className={styles.container}>
      <Stack gap="xl">
        {/* Заголовок страницы */}
        <div>
          <Title order={1} fw={700} mb="xs">
            Аналитика
          </Title>
          <Text c="dimmed" size="sm">
            Детальный анализ ваших финансов и расходов
          </Text>
        </div>

        <Divider />

        {/* Состояние загрузки */}
        {isLoading && (
          <Center py="xl">
            <Stack align="center" gap="md">
              <Loader size="lg" />
              <Text c="dimmed" size="sm">Загрузка данных...</Text>
            </Stack>
          </Center>
        )}

        {/* Состояние ошибки */}
        {hasError && !isLoading && (
          <Alert color="red" title="Ошибка загрузки данных" mb="md">
            <Text size="sm">
              {accountsError ? 'Не удалось загрузить данные о счетах' : ''}
              {statisticsError ? 'Не удалось загрузить статистику' : ''}
            </Text>
          </Alert>
        )}

        {/* Основной контент */}
        {!isLoading && (
          <Grid gutter={{ base: 'md', md: 'lg' }}>
            {/* Левая колонка - Карты */}
            <Grid.Col span={{ base: 12, lg: 4 }}>
              <Card padding="lg" radius="md" withBorder className={styles.cardsCard}>
                <Stack gap="md">
                  <div>
                    <Title order={3} size="h4" fw={600} mb={4}>
                      Счета
                    </Title>
                    <Text c="dimmed" size="xs">
                      Выберите счет для анализа
                    </Text>
                  </div>
                  <Cards 
                    accountsData={accountsData} 
                    onCardChange={handleCardChange}
                    selectedBankId={selectedBank}
                  />
                </Stack>
              </Card>
            </Grid.Col>

            {/* Правая колонка - Графики и аналитика */}
            <Grid.Col span={{ base: 12, lg: 8 }}>
              <Stack gap="lg">
                {/* Круговая диаграмма */}
                <Card padding="lg" radius="md" withBorder>
                  <Stack gap="md">
                    <div>
                      <Title order={3} size="h4" fw={600} mb={4}>
                        Доходы и расходы
                      </Title>
                      <Text c="dimmed" size="xs">
                        Соотношение поступлений и трат
                      </Text>
                    </div>
                    <Center>
                      <DonutChart 
                        selectedBankId={selectedBank}
                        statisticsData={statisticsData}
                      />
                    </Center>
                  </Stack>
                </Card>

                {/* График баланса */}
                <Card padding="lg" radius="md" withBorder>
                  <BalanceAnalytics 
                    selectedBankId={selectedBank}
                    accountsData={accountsData}
                    statisticsData={statisticsData}
                  />
                </Card>
              </Stack>
            </Grid.Col>
          </Grid>
        )}
      </Stack>
    </Container>
  );
}
