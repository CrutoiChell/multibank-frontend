'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Container,
  Grid,
  Card,
  Text,
  Group,
  Stack,
  Badge,
  Button,
  Title,
  Loader,
  Center,
  Alert,
  TextInput,
  Modal,
  Divider,
} from '@mantine/core';
import {
  IconTrendingUp,
  IconTrendingDown,
  IconArrowUpRight,
  IconArrowDownRight,
  IconChevronDown,
  IconChevronUp,
  IconHistory,
  IconRotateClockwise,
  IconSearch,
  IconAlertCircle,
  IconInfoCircle,
  IconClock,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  useGetBanksQuery,
  useBankConsentMutation,
  useLazyGetBankConsentStatusQuery,
  useGetBankOverviewQuery,
  useSyncBanksMutation,
  useLazyGetTransactionsQuery,
  TransactionFromAPI,
  useGetTransactionsStatisticsQuery,
  useDeleteBankMutation,
  useLazyGetAccountTransactionsQuery,
} from '@/lib/store/api/AuthApi';
import { useGetCurrentUserQuery } from '@/lib/store/api/UserApi';
import StatisticsChart from './StatisticsChart';
import Link from 'next/link';

const PAGE_STYLES = {
  background: '#F5F7FA',
  cardBackground: '#FFFFFF',
  paperBackground: '#F8F9FA',
  buttonBlue: '#1E90FF',
  successGreen: '#28a745',
  accentPurple: '#9C27B0',
  accentOrange: '#FF6B35',
  textPrimary: '#1A1A1A',
  textSecondary: '#6C757D',
  borderColor: '#E0E0E0',
} as const;

const formatBalance = (balance: string | number | undefined | null, currency: string = 'RUB'): string => {
  if (balance === undefined || balance === null || balance === '') {
    return '0.00';
  }
  const num = typeof balance === 'string' ? parseFloat(balance) : balance;
  if (isNaN(num)) {
    return '0.00';
  }
  return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
};

export default function Dashboard() {
  const { isLoading: authLoading, isSuccess: authOk } = useGetCurrentUserQuery();

  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [consentRequestId, setConsentRequestId] = useState<string | null>(null);
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [banksExpanded, setBanksExpanded] = useState(false);
  const [transactionsExpanded, setTransactionsExpanded] = useState(false);
  const [loadedTransactions, setLoadedTransactions] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [hasMoreTransactions, setHasMoreTransactions] = useState(true);
  const [loadingMoreTransactions, setLoadingMoreTransactions] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [selectedBankDetails, setSelectedBankDetails] = useState<string | null>(null);
  const [deleteBankModalOpen, setDeleteBankModalOpen] = useState(false);
  const [bankToDelete, setBankToDelete] = useState<{ bankId: string; accountId: number; bankName: string } | null>(null);

  const { data: banksData, isLoading: banksLoading } = useGetBanksQuery();
  const [bankConsent] = useBankConsentMutation();
  const [getBankConsentStatus] = useLazyGetBankConsentStatusQuery();
  // Убираем refresh: true из дефолтного параметра, чтобы избежать частых рефетчей
  const { data: accountsData, isLoading: accountsLoading, error: accountsError, refetch: refetchAccountsBase } = useGetBankOverviewQuery({});
  const [syncBanks] = useSyncBanksMutation();
  const [getTransactions] = useLazyGetTransactionsQuery();
  const { data: statisticsData } = useGetTransactionsStatisticsQuery();
  const [deleteBank] = useDeleteBankMutation();
  const [getAccountTransactions] = useLazyGetAccountTransactionsQuery();
  
  // Debounce для рефетчей, чтобы избежать множественных одновременных обновлений
  const refetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastRefetchTimeRef = useRef<number>(0);
  // Отслеживаем, для каких аккаунтов уже были загружены транзакции
  const processedAccountsRef = useRef<Set<string>>(new Set());
  
  const refetchAccounts = useCallback(() => {
    const now = Date.now();
    // Если прошло меньше 2 секунд с последнего рефетча, отменяем предыдущий и планируем новый
    if (now - lastRefetchTimeRef.current < 2000) {
      if (refetchTimeoutRef.current) {
        clearTimeout(refetchTimeoutRef.current);
      }
      refetchTimeoutRef.current = setTimeout(() => {
        lastRefetchTimeRef.current = Date.now();
        refetchAccountsBase();
      }, 2000);
      return;
    }
    
    // Иначе делаем рефетч сразу
    lastRefetchTimeRef.current = now;
    refetchAccountsBase();
  }, [refetchAccountsBase]);
  
  // Cleanup timeout при размонтировании компонента
  useEffect(() => {
    return () => {
      if (refetchTimeoutRef.current) {
        clearTimeout(refetchTimeoutRef.current);
      }
    };
  }, []);

  // Автоматически загружаем транзакции для всех подключенных банков при загрузке страницы
  useEffect(() => {
    if (!accountsData?.banks || accountsLoading) return;

    // Для каждого банка и каждого аккаунта вызываем getAccountTransactions
    accountsData.banks.forEach((bank) => {
      if (!bank.accounts || bank.accounts.length === 0) return;

      bank.accounts.forEach((account) => {
        if (!account.accountId || !bank.bankId) return;

        // Создаем уникальный ключ для аккаунта
        const accountKey = `${bank.bankId}-${account.accountId}`;

        // Проверяем, не обрабатывали ли мы уже этот аккаунт
        if (processedAccountsRef.current.has(accountKey)) return;

        // Помечаем аккаунт как обработанный
        processedAccountsRef.current.add(accountKey);

        // Вызываем getAccountTransactions для этого аккаунта (первый раз после подключения банка)
        getAccountTransactions({
          bankId: bank.bankId,
          accountId: account.accountId,
        }).catch((error) => {
          if (process.env.NODE_ENV === 'development') {
            console.error(`Error loading transactions for ${bank.bankId}/${account.accountId}:`, error);
          }
          // Удаляем из обработанных, чтобы можно было повторить попытку
          processedAccountsRef.current.delete(accountKey);
        });
      });
    });
  }, [accountsData, accountsLoading, getAccountTransactions]);

  const loadInitialTransactions = useCallback(async () => {
    setTransactionsLoading(true);
    setTransactionsPage(1);
    
    try {
      const result = await getTransactions({
        page: 1,
        limit: 30,
      });
      
      if (result.data?.transactions) {
        setLoadedTransactions(result.data.transactions);
        setHasMoreTransactions(result.data.transactions.length === 30);
        if (process.env.NODE_ENV === 'development') {
          console.log('Loaded initial transactions:', result.data.transactions.length);
          console.log('Transactions data:', result.data.transactions.slice(0, 3));
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('No transactions in response:', result.data);
        }
        setLoadedTransactions([]);
        setHasMoreTransactions(false);
      }
    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading initial transactions:', error);
        console.error('Error details:', error?.status, error?.data);
      }
      setLoadedTransactions([]);
      setHasMoreTransactions(false);
    } finally {
      setTransactionsLoading(false);
    }
  }, [getTransactions]);

  useEffect(() => {
    loadInitialTransactions();
  }, [loadInitialTransactions]);

  const loadMoreTransactions = useCallback(async () => {
    if (loadingMoreTransactions || !hasMoreTransactions) return;

    setLoadingMoreTransactions(true);
    const nextPage = transactionsPage + 1;

    try {
      const result = await getTransactions({
        page: nextPage,
        limit: 30,
      });
      
      if (result.data?.transactions && result.data.transactions.length > 0) {
        const newTransactions = result.data.transactions;
        setLoadedTransactions(prev => [...prev, ...newTransactions]);
        setTransactionsPage(nextPage);
        setHasMoreTransactions(newTransactions.length === 30);
      } else {
        setHasMoreTransactions(false);
      }
    } catch (error) {
      console.error('Error loading more transactions', error);
      setHasMoreTransactions(false);
    } finally {
      setLoadingMoreTransactions(false);
    }
  }, [getTransactions, transactionsPage, hasMoreTransactions, loadingMoreTransactions]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    
    if (scrollBottom < 100 && hasMoreTransactions && !loadingMoreTransactions) {
      loadMoreTransactions();
    }
  }, [hasMoreTransactions, loadingMoreTransactions, loadMoreTransactions]);

  const totalBalance = useMemo(() => {
    if (!accountsData?.banks) return 0;
    let total = 0;
    accountsData.banks.forEach((bank) => {
      (bank.accounts || []).forEach((account) => {
        const balance = account.balance || account.balances?.[0]?.amount || '0';
        const balanceNum = parseFloat(String(balance));
        if (!isNaN(balanceNum)) {
          total += balanceNum;
        }
      });
    });
    return total;
  }, [accountsData]);

  const allTransactions = useMemo(() => {
    if (!loadedTransactions || loadedTransactions.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Dashboard - No loaded transactions, length:', loadedTransactions?.length || 0);
      }
      return [];
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('Dashboard - Processing transactions:', loadedTransactions.length);
    }

    const transformed = loadedTransactions.map((tx: any) => {
      const isNewFormat = tx.id !== undefined && tx.type !== undefined;
      
      if (isNewFormat) {
        const uniqueKey = `tx_${tx.id}`;
        const isCredit = tx.type === 'INCOME';
        const transactionDate = tx.bookingDateTime || tx.valueDateTime || tx.createdAt || tx.updatedAt;
        
        return {
          ...tx,
          uniqueKey,
          transactionId: tx.id.toString(),
          accountId: tx.accountId?.toString() || '',
          amount: tx.amount,
          currency: tx.currency,
          creditDebitIndicator: (isCredit ? 'Credit' : 'Debit') as 'Credit' | 'Debit',
          status: 'Booked',
          bookingDateTime: tx.bookingDateTime || transactionDate,
          valueDateTime: tx.valueDateTime || transactionDate,
          transactionInformation: tx.description || '',
          date: transactionDate,
          bankId: tx.account?.bankName || '',
          merchant: tx.merchant,
          category: tx.category,
        };
      }
      
      const uniqueKey = tx.transactionId || `tx_${tx.accountId}_${tx.bookingDateTime}`;
      const transactionDate = tx.bookingDateTime || tx.valueDateTime;
      
      return {
        ...tx,
        uniqueKey,
        transactionId: tx.transactionId || '',
        accountId: tx.accountId || '',
        amount: tx.amount,
        currency: tx.amount?.currency || tx.currency || 'RUB',
        creditDebitIndicator: tx.creditDebitIndicator || 'Debit',
        status: tx.status || 'Booked',
        bookingDateTime: transactionDate,
        valueDateTime: tx.valueDateTime || transactionDate,
        transactionInformation: tx.description || tx.transactionInformation || '',
        date: transactionDate,
        bankId: tx.bankId || '',
        merchant: tx.merchantName || tx.merchant,
        category: tx.category,
      };
    });

    return transformed.sort((a, b) => {
      const dateA = new Date(a.date || a.bookingDateTime || a.valueDateTime || a.createdAt || 0).getTime();
      const dateB = new Date(b.date || b.bookingDateTime || b.valueDateTime || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [loadedTransactions]);

  const incomeExpense = useMemo(() => {
    if (statisticsData?.monthlyStats && Array.isArray(statisticsData.monthlyStats) && statisticsData.monthlyStats.length > 0) {
      const sortedStats = [...statisticsData.monthlyStats].sort((a, b) => {
        const parseMonth = (monthStr: string): Date => {
          const monthNames: Record<string, number> = {
            'январь': 0, 'февраль': 1, 'март': 2, 'апрель': 3, 'май': 4, 'июнь': 5,
            'июль': 6, 'август': 7, 'сентябрь': 8, 'октябрь': 9, 'ноябрь': 10, 'декабрь': 11
          };
          
          const parts = monthStr.toLowerCase().split(' ');
          const monthName = parts[0];
          const year = parseInt(parts[1]) || new Date().getFullYear();
          const monthIndex = monthNames[monthName] ?? 0;
          
          return new Date(year, monthIndex, 1);
        };

        const dateA = parseMonth(a.month || '');
        const dateB = parseMonth(b.month || '');
        
        return dateB.getTime() - dateA.getTime();
      });

      const lastMonth = sortedStats[0];
      if (lastMonth) {
        return {
          income: lastMonth.income || 0,
          expense: lastMonth.expenses || 0,
        };
      }
    }

    let income = 0;
    let expense = 0;

    const now = new Date();
    const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    allTransactions.forEach((transaction: any) => {
      const transactionDate = transaction.date || transaction.bookingDateTime || transaction.valueDateTime;
      if (!transactionDate) return;

      const txDate = new Date(transactionDate);
      
      if (isNaN(txDate.getTime())) return;
      
      if (txDate < firstDayOfCurrentMonth || txDate > lastDayOfCurrentMonth) {
        return;
      }

      const amount = typeof transaction.amount === 'number' 
        ? transaction.amount 
        : parseFloat(String(transaction.amount || '0'));

      if (!isNaN(amount) && amount !== 0) {
        if (transaction.type === 'INCOME' || transaction.creditDebitIndicator === 'Credit') {
          income += Math.abs(amount);
        } else if (transaction.type === 'EXPENSE' || transaction.creditDebitIndicator === 'Debit') {
          expense += Math.abs(amount);
        }
      }
    });

    return { income, expense };
  }, [allTransactions, statisticsData]);

  const savingsChangePercent = useMemo(() => {
    if (!statisticsData?.monthlyStats || !Array.isArray(statisticsData.monthlyStats) || statisticsData.monthlyStats.length < 2) {
      return null;
    }

    const sortedStats = [...statisticsData.monthlyStats].sort((a, b) => {
      const parseMonth = (monthStr: string): Date => {
        const monthNames: Record<string, number> = {
          'январь': 0, 'февраль': 1, 'март': 2, 'апрель': 3, 'май': 4, 'июнь': 5,
          'июль': 6, 'август': 7, 'сентябрь': 8, 'октябрь': 9, 'ноябрь': 10, 'декабрь': 11
        };
        
        const parts = monthStr.toLowerCase().split(' ');
        const monthName = parts[0];
        const year = parseInt(parts[1]) || new Date().getFullYear();
        const monthIndex = monthNames[monthName] ?? 0;
        
        return new Date(year, monthIndex, 1);
      };

      const dateA = parseMonth(a.month || '');
      const dateB = parseMonth(b.month || '');
      
      return dateB.getTime() - dateA.getTime();
    });

    const currentMonth = sortedStats[0];
    const previousMonth = sortedStats[1];

    if (!currentMonth || !previousMonth) {
      return null;
    }

    // Рассчитываем чистый доход (доходы - расходы) для обоих месяцев
    const currentNetIncome = (currentMonth.income || 0) - (currentMonth.expenses || 0);
    const previousNetIncome = (previousMonth.income || 0) - (previousMonth.expenses || 0);

    // Вычисляем предполагаемый баланс предыдущего месяца
    // Текущий баланс минус чистый доход текущего месяца = баланс на начало месяца
    const previousMonthBalance = totalBalance - currentNetIncome;
    
    // Если баланс предыдущего месяца отрицательный или нулевой, не можем рассчитать процент
    if (previousMonthBalance <= 0) {
      return null;
    }

    // Сбережения = 10% от баланса
    const currentSavings = totalBalance * 0.1;
    const previousSavings = previousMonthBalance * 0.1;

    // Если сбережения предыдущего месяца были нулевыми
    if (previousSavings <= 0) {
      return currentSavings > 0 ? 100 : 0;
    }

    // Рассчитываем процент изменения сбережений
    const percentChange = ((currentSavings - previousSavings) / previousSavings) * 100;
    
    // Округляем до 2 знаков после запятой
    return Math.round(percentChange * 100) / 100;
  }, [statisticsData, totalBalance]);

  const banksList = useMemo(() => {
    if (!banksData?.banks) return [];
    const filtered = banksData.banks.filter((bankId) =>
      bankId.toLowerCase().includes(bankSearchQuery.toLowerCase())
    );
    return banksExpanded ? filtered : filtered.slice(0, 5);
  }, [banksData, bankSearchQuery, banksExpanded]);


  const handleBankConnect = (bankId: string) => {
    setSelectedBank(bankId);
    setConsentModalOpen(true);
  };

  const handleConsentSubmit = async () => {
    if (!selectedBank) return;

    try {
      const result = await bankConsent({
        bankId: selectedBank,
        data: clientId ? { client_id: clientId } : undefined,
      }).unwrap();

      setConsentRequestId(result.requestId);
      setConsentModalOpen(false);
      notifications.show({
        title: 'Запрос отправлен',
        message: result.message,
        color: 'blue',
      });

      let endpointExists = true;
      let checkCount = 0;
      const maxChecks = 15;
      
      const checkStatus = setInterval(async () => {
        if (!selectedBank || !result.requestId || !endpointExists) {
          clearInterval(checkStatus);
          return;
        }

        checkCount++;
        if (checkCount > maxChecks) {
          clearInterval(checkStatus);
          return;
        }

        try {
          const statusResult = await getBankConsentStatus({
            bankId: selectedBank,
            requestId: result.requestId,
          }).unwrap();

          if (statusResult.status === 'approved') {
            clearInterval(checkStatus);
            notifications.show({
              title: 'Банк подключен',
              message: 'Согласие получено. Данные обновляются...',
              color: 'green',
            });
            // Используем refresh: true для принудительного обновления после подключения банка
            setTimeout(() => {
              refetchAccounts();
            }, 1000);
          }
        } catch (error: any) {
          if (error?.status === 404) {
            endpointExists = false;
            clearInterval(checkStatus);
            setTimeout(() => {
              refetchAccounts();
            }, 3000);
            return;
          }
          
          if (process.env.NODE_ENV === 'development') {
            console.log('Bank consent status check error:', error?.status, error?.data);
          }
        }
      }, 2000);
    } catch (error: any) {
      let errorMessage = 'Не удалось отправить запрос';
      
      if (error?.status === 404) {
        errorMessage = 'Эндпоинт не найден. Убедитесь, что бэкенд запущен и доступен.';
      } else if (error?.status === 401 || error?.status === 403) {
        errorMessage = 'Ошибка аутентификации. Пожалуйста, войдите заново.';
      } else if (error?.data?.message) {
        errorMessage = error.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      notifications.show({
        title: 'Ошибка подключения банка',
        message: errorMessage,
        color: 'red',
      });
    }
  };

  const handleSyncBanks = async () => {
    try {
      await syncBanks().unwrap();
      notifications.show({
        title: 'Синхронизация запущена',
        message: 'Данные обновляются...',
        color: 'blue',
      });
      setTimeout(() => {
        refetchAccounts();
      }, 2000);
    } catch (error: any) {
      let errorMessage = 'Не удалось запустить синхронизацию';
      
      if (error?.status === 404) {
        errorMessage = 'Эндпоинт не найден. Убедитесь, что бэкенд запущен и доступен.';
      } else if (error?.status === 401 || error?.status === 403) {
        errorMessage = 'Ошибка аутентификации. Пожалуйста, войдите заново.';
      } else if (error?.data?.message) {
        errorMessage = error.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      notifications.show({
        title: 'Ошибка синхронизации',
        message: errorMessage,
        color: 'red',
      });
    }
  };

  const handleDeleteBankClick = (e: React.MouseEvent, bankId: string) => {
    e.stopPropagation(); // Предотвращаем открытие модального окна с деталями банка
    
    const bank = accountsData?.banks?.find(b => b.bankId === bankId);
    const firstAccount = bank?.accounts?.[0];
    
    if (!firstAccount || !firstAccount.id) {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось найти аккаунт для удаления',
        color: 'red',
      });
      return;
    }
    
    const bankName = firstAccount.bankName || bankId;
    const accountId = firstAccount.id;
    
    setBankToDelete({ bankId, accountId, bankName });
    setDeleteBankModalOpen(true);
  };

  const handleConfirmDeleteBank = async () => {
    if (!bankToDelete) return;
    
    try {
      await deleteBank(bankToDelete.accountId).unwrap();
      notifications.show({
        title: 'Банк удален',
        message: 'Банк успешно удален из системы',
        color: 'green',
      });
      setDeleteBankModalOpen(false);
      setBankToDelete(null);
      setTimeout(() => {
        refetchAccounts();
      }, 500);
    } catch (error: any) {
      let errorMessage = 'Не удалось удалить банк';
      
      if (error?.status === 404) {
        errorMessage = 'Банк не найден';
      } else if (error?.status === 401 || error?.status === 403) {
        errorMessage = 'Ошибка аутентификации. Пожалуйста, войдите заново.';
      } else if (error?.data?.message) {
        errorMessage = error.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      notifications.show({
        title: 'Ошибка удаления',
        message: errorMessage,
        color: 'red',
      });
    }
  };

  if (authLoading) {
    return (
      <Container size="xl" py="xl">
        <Center h={400}>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text c="dimmed">Загрузка...</Text>
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
            <Title order={2}>Пожалуйста, авторизуйтесь</Title>
            <Text c="dimmed">Для доступа к дашборду нужен вход в систему</Text>
            <Group>
              <Button component={Link as any} href="/login">Войти</Button>
              <Button variant="light" component={Link as any} href="/registration">Регистрация</Button>
            </Group>
          </Stack>
        </Center>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <Stack gap="lg">
        <Title order={1} size="h2" fw={700} c={PAGE_STYLES.textPrimary}>
          Дашборд
        </Title>

        <div style={{
          display: 'flex',
          gap: 'var(--mantine-spacing-lg)',
          alignItems: 'stretch',
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            gap: 'var(--mantine-spacing-lg)',
          }}>
            <div style={{
              display: 'flex',
              gap: 'var(--mantine-spacing-lg)',
              alignItems: 'stretch',
            }}>
              <div style={{ flex: 1 }}>
                <Card
                  padding="xl"
                  radius="xl"
                  style={{
                    background: PAGE_STYLES.cardBackground,
                    border: `1px solid ${PAGE_STYLES.borderColor}`,
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Stack gap="md" style={{ height: '100%' }}>
                    <Text size="sm" c={PAGE_STYLES.textSecondary} fw={500}>
                      Общий баланс
                    </Text>
                    <Title order={1} style={{ fontSize: '2rem', lineHeight: 1.2, color: PAGE_STYLES.textPrimary, fontWeight: 700 }}>
                      {totalBalance > 0 
                        ? totalBalance.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽'
                        : accountsLoading 
                          ? 'Загрузка...' 
                          : '0.00 ₽'}
                    </Title>
                    <Group gap="lg" mt="xs">
                      <Stack gap={4}>
                        <Text size="xs" c={PAGE_STYLES.textSecondary}>Доходы за месяц</Text>
                        <Text size="md" fw={600} c={PAGE_STYLES.successGreen}>
                          {incomeExpense.income > 0 
                            ? formatBalance(incomeExpense.income.toString(), 'RUB')
                            : '0.00 RUB'}
                        </Text>
                      </Stack>
                      <Stack gap={4}>
                        <Text size="xs" c={PAGE_STYLES.textSecondary}>Расходы за месяц</Text>
                        <Text size="md" fw={600} c="#EF4444">
                          {incomeExpense.expense > 0 
                            ? formatBalance(incomeExpense.expense.toString(), 'RUB')
                            : '0.00 RUB'}
                        </Text>
                      </Stack>
                    </Group>
                  </Stack>
                </Card>
              </div>

              <div style={{ flex: 1 }}>
                <Card
                  padding="xl"
                  radius="xl"
                  style={{
                    background: PAGE_STYLES.cardBackground,
                    border: `1px solid ${PAGE_STYLES.borderColor}`,
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Stack gap="md" style={{ height: '100%', justifyContent: 'space-between' }}>
                    <div>
                      <Text size="sm" c={PAGE_STYLES.textSecondary} fw={500}>
                        Сбережения
                      </Text>
                      <Title order={1} style={{ fontSize: '2rem', lineHeight: 1.2, color: PAGE_STYLES.textPrimary, fontWeight: 700, marginTop: '8px' }}>
                        {totalBalance > 0 
                          ? (totalBalance * 0.1).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽'
                          : '0.00 ₽'}
                      </Title>
                    </div>
                    <Group gap="xs" mt="auto">
                      {savingsChangePercent !== null ? (
                        <>
                          {savingsChangePercent >= 0 ? (
                            <IconTrendingUp size={16} color={PAGE_STYLES.successGreen} />
                          ) : (
                            <IconTrendingDown size={16} color="#EF4444" />
                          )}
                          <Text size="xs" c={savingsChangePercent >= 0 ? PAGE_STYLES.successGreen : "#EF4444"}>
                            {savingsChangePercent >= 0 ? '+' : ''}{savingsChangePercent.toFixed(2)}% за месяц
                          </Text>
                        </>
                      ) : (
                        <>
                          <IconTrendingUp size={16} color={PAGE_STYLES.textSecondary} />
                          <Text size="xs" c={PAGE_STYLES.textSecondary}>
                            Нет данных
                          </Text>
                        </>
                      )}
                    </Group>
                  </Stack>
                </Card>
              </div>
            </div>

            {/* Показываем карточку статистики только если есть данные */}
            {(() => {
              const hasStatisticsData = statisticsData && (
                (statisticsData.monthlyStats && statisticsData.monthlyStats.length > 0) ||
                (statisticsData.totalIncome && statisticsData.totalIncome > 0) ||
                (statisticsData.totalExpenses && statisticsData.totalExpenses > 0) ||
                (statisticsData.transactionsCount && statisticsData.transactionsCount > 0)
              );
              
              if (!hasStatisticsData) {
                return null;
              }
              
              return (
                <div>
                  <Card
                    padding="xl"
                    radius="xl"
                    style={{
                      background: PAGE_STYLES.cardBackground,
                      border: `1px solid ${PAGE_STYLES.borderColor}`,
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                    }}
                  >
                    <Stack gap="md">
                      <Group justify="space-between" align="center">
                        <Title order={3} size="h4" fw={600} c={PAGE_STYLES.textPrimary}>
                          Статистика
                        </Title>
                      </Group>

                      <StatisticsChart transactions={allTransactions} />
                    </Stack>
                  </Card>
                </div>
              );
            })()}
          </div>

          <div style={{
            flex: '0 0 550px',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--mantine-spacing-lg)',
          }}>
            <Card
              padding="xl"
              radius="xl"
              style={{
                background: PAGE_STYLES.cardBackground,
                border: `1px solid ${PAGE_STYLES.borderColor}`,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                height: '600px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <Stack gap="md" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Title order={3} size="h4" fw={600} c={PAGE_STYLES.textPrimary} style={{ flexShrink: 0 }}>
                  Транзакции
                  {allTransactions.length > 0 && (
                    <Text component="span" size="sm" fw={400} c={PAGE_STYLES.textSecondary} ml="xs">
                      ({allTransactions.length})
                    </Text>
                  )}
                </Title>
                
                {transactionsLoading ? (
                  <Center py="md" style={{ flex: 1, minHeight: 0 }}>
                    <Loader size="sm" />
                  </Center>
                ) : loadedTransactions.length === 0 && !transactionsLoading ? (
                  <Center py="md" style={{ flex: 1, minHeight: 0 }}>
                    <Stack gap="md" align="center">
                      <IconHistory size={48} color={PAGE_STYLES.textSecondary} />
                      <Text size="sm" c={PAGE_STYLES.textSecondary} ta="center">
                        Нет транзакций
                      </Text>
                      <Text size="xs" c={PAGE_STYLES.textSecondary} ta="center" maw={300}>
                        Транзакции появятся после синхронизации с банками. 
                        Нажмите "Синхронизировать" в разделе банков.
                      </Text>
                      <Button 
                        size="sm" 
                        variant="light"
                        onClick={async () => {
                          try {
                            await syncBanks().unwrap();
                            notifications.show({
                              title: 'Синхронизация запущена',
                              message: 'Транзакции будут загружены в течение нескольких минут',
                              color: 'blue',
                            });
                            setTimeout(() => {
                              loadInitialTransactions();
                            }, 5000);
                          } catch (error: any) {
                            notifications.show({
                              title: 'Ошибка синхронизации',
                              message: error?.data?.message || 'Не удалось запустить синхронизацию',
                              color: 'red',
                            });
                          }
                        }}
                      >
                        Синхронизировать банки
                      </Button>
                    </Stack>
                  </Center>
                ) : allTransactions.length > 0 ? (
                  <div
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      paddingRight: '8px',
                      minHeight: 0,
                      maxHeight: '100%',
                    }}
                    className="transactions-scroll"
                    onScroll={handleScroll}
                  >
                    <Stack gap={0}>
                    {allTransactions.map((transaction: any, index) => {
                      const transactionDate = transaction.date || transaction.bookingDateTime || transaction.valueDateTime || transaction.createdAt || transaction.updatedAt || transaction.transactionDate;
                      const date = transactionDate ? new Date(transactionDate) : new Date();
                      const day = date.getDate();
                      const monthNames = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
                      const month = monthNames[date.getMonth()] || '';
                      const hours = date.getHours().toString().padStart(2, '0');
                      const minutes = date.getMinutes().toString().padStart(2, '0');
                      const timeStr = `${hours}:${minutes}`;

                      let amount = 0;
                      if (typeof transaction.amount === 'number') {
                        amount = transaction.amount;
                      } else if (typeof transaction.amount === 'object' && transaction.amount?.amount) {
                        amount = parseFloat(String(transaction.amount.amount || '0'));
                      } else {
                        amount = parseFloat(String(transaction.amount || transaction.value || '0'));
                      }

                      const isCredit = transaction.type === 'INCOME' || transaction.creditDebitIndicator === 'Credit';
                      const currency = transaction.currency || transaction.amount?.currency || 'RUB';
                      const amountStr = isCredit
                        ? `+${formatBalance(Math.abs(amount).toString(), currency)}`
                        : `-${formatBalance(Math.abs(amount).toString(), currency)}`;

                      const name = transaction.transactionInformation || transaction.description || transaction.name || transaction.merchant || 'Транзакция';
                      const status = transaction.status || 'Booked';
                      const transactionCode = transaction.bankTransactionCode?.code || transaction.category || '';

                      return (
                        <Card
                          key={transaction.uniqueKey || `${transaction.bankId || ''}_${transaction.accountId || ''}_${transaction.transactionId || transaction.id || index}`}
                          p="md"
                          style={{
                            backgroundColor: 'transparent',
                            borderRadius: '12px',
                            border: `1px solid ${PAGE_STYLES.borderColor}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            marginBottom: '8px',
                          }}
                          onClick={() => {
                            setSelectedTransaction(transaction);
                            setTransactionModalOpen(true);
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#F8F9FA';
                            e.currentTarget.style.borderColor = PAGE_STYLES.buttonBlue;
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.borderColor = PAGE_STYLES.borderColor;
                            e.currentTarget.style.boxShadow = 'none';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          <Group justify="space-between" wrap="nowrap" gap="md" align="flex-start">
                            <Group gap="md" style={{ flex: 1, minWidth: 0 }} align="flex-start">
                              <div
                                style={{
                                  width: '44px',
                                  height: '44px',
                                  borderRadius: '10px',
                                  background: isCredit
                                    ? `${PAGE_STYLES.successGreen}12`
                                    : `${PAGE_STYLES.accentOrange}12`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                {isCredit ? (
                                  <IconArrowUpRight size={20} color={PAGE_STYLES.successGreen} strokeWidth={2.5} />
                                ) : (
                                  <IconArrowDownRight size={20} color={PAGE_STYLES.accentOrange} strokeWidth={2.5} />
                                )}
                              </div>

                              <Stack gap={6} style={{ flex: 1, minWidth: 0, maxWidth: '100%' }}>
                                <Text 
                                  size="sm" 
                                  fw={600} 
                                  style={{ 
                                    color: PAGE_STYLES.textPrimary, 
                                    lineHeight: 1.4,
                                    fontSize: '14px',
                                    letterSpacing: '-0.01em',
                                    wordBreak: 'break-word',
                                    overflowWrap: 'break-word'
                                  }}
                                  lineClamp={2}
                                >
                                  {name}
                                </Text>
                                
                                <Group gap={8} wrap="wrap" align="center" style={{ width: '100%' }}>
                                  <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
                                    <IconClock size={13} color={PAGE_STYLES.textSecondary} strokeWidth={2} />
                                    <Text 
                                      size="xs" 
                                      c={PAGE_STYLES.textSecondary}
                                      style={{
                                        fontSize: '12px',
                                        lineHeight: 1.4,
                                        fontWeight: 400,
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      {day} {month} {date.getFullYear() !== new Date().getFullYear() ? date.getFullYear() : ''} в {timeStr}
                                    </Text>
                                  </Group>
                                </Group>
                                
                                {transactionCode && (
                                  <Text 
                                    size="xs" 
                                    c={PAGE_STYLES.textSecondary}
                                    style={{ 
                                      fontSize: '11px',
                                      lineHeight: 1.4,
                                      fontWeight: 400,
                                      opacity: 0.7,
                                      wordBreak: 'break-word',
                                      overflowWrap: 'break-word'
                                    }}
                                    lineClamp={1}
                                  >
                                    {transactionCode}
                                  </Text>
                                )}
                              </Stack>
                            </Group>

                            <Stack gap={4} align="flex-end" style={{ flexShrink: 0 }}>
                              <Text
                                fw={700}
                                size="sm"
                                style={{
                                  color: isCredit ? PAGE_STYLES.successGreen : PAGE_STYLES.textPrimary,
                                  whiteSpace: 'nowrap',
                                  fontSize: '15px',
                                  lineHeight: 1.3,
                                  letterSpacing: '-0.02em',
                                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                                }}
                              >
                                {amountStr}
                              </Text>
                              {status === 'Booked' && (
                                <Badge
                                  size="xs"
                                  variant="light"
                                  color="green"
                                  leftSection={<IconCheck size={9} />}
                                  style={{ 
                                    flexShrink: 0,
                                    fontSize: '10px',
                                    height: '18px',
                                    padding: '0 6px'
                                  }}
                                >
                                  Подтверждено
                                </Badge>
                              )}
                            </Stack>
                          </Group>
                        </Card>
                      );
                    })}
                    </Stack>
                    
                    {hasMoreTransactions && (
                      <div style={{ padding: '16px', display: 'flex', justifyContent: 'center' }}>
                        <Button
                          variant="light"
                          size="sm"
                          onClick={loadMoreTransactions}
                          loading={loadingMoreTransactions}
                          leftSection={<IconRotateClockwise size={16} />}
                        >
                          Загрузить еще
                        </Button>
                      </div>
                    )}
                    
                    {loadingMoreTransactions && (
                      <Center py="md">
                        <Loader size="sm" />
                      </Center>
                    )}
                  </div>
                ) : (
                  <Center py="xl" style={{ flex: 1 }}>
                    <Stack align="center" gap="xs">
                      <IconHistory size={32} color={PAGE_STYLES.textSecondary} />
                      <Text size="sm" c={PAGE_STYLES.textSecondary}>
                        Нет транзакций
                      </Text>
                    </Stack>
                  </Center>
                )}
              </Stack>
            </Card>

          </div>
        </div>

        <Card
          padding="xl"
          radius="xl"
          style={{
            background: PAGE_STYLES.cardBackground,
            border: `1px solid ${PAGE_STYLES.borderColor}`,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <Title order={3} size="h4" fw={600} c={PAGE_STYLES.textPrimary}>
                Мои счета
              </Title>
              <Button
                variant="light"
                size="sm"
                leftSection={<IconRotateClockwise size={16} />}
                onClick={handleSyncBanks}
                loading={accountsLoading}
              >
                Синхронизировать
              </Button>
            </Group>

            {accountsError && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                title="Ошибка загрузки счетов"
                color="red"
                mb="md"
              >
                {(() => {
                    const errorMessage = accountsError && 'data' in accountsError 
                    ? String(accountsError.data) 
                    : accountsError && 'message' in accountsError
                    ? String(accountsError.message)
                    : 'Не удалось загрузить счета';
                  
                  const needsReconnect = errorMessage.includes('недействительно') ||
                                        errorMessage.includes('не связано с client_id') ||
                                        errorMessage.includes('CONSENT_REQUIRED');
                  
                  if (needsReconnect) {
                    return (
                      <div>
                        <Text size="sm" mb="xs">{errorMessage}</Text>
                        <Text size="sm" c="dimmed" mb="xs">
                          Необходимо пересоздать согласие с правильным client_id.
                        </Text>
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => {
                            const bankMatch = errorMessage.match(/для банка (\w+)/i) || 
                                            errorMessage.match(/bank[:\s]+(\w+)/i);
                            if (bankMatch && bankMatch[1]) {
                              handleBankConnect(bankMatch[1]);
                            } else {
                              notifications.show({
                                title: 'Информация',
                                message: 'Выберите банк из списка и нажмите "Подключить" для пересоздания согласия',
                                color: 'blue',
                              });
                            }
                          }}
                        >
                          Пересоздать согласие
                        </Button>
                      </div>
                    );
                  }
                  
                  return <Text size="sm">{errorMessage}</Text>;
                })()}
              </Alert>
            )}

            {accountsLoading ? (
              <Center py="xl">
                <Loader size="md" />
              </Center>
            ) : accountsData?.banks && accountsData.banks.length > 0 ? (
              <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', 
              gap: '24px',
            }}>
                {accountsData.banks.map((bank) => {
                  const bankName = (bank.accounts && bank.accounts.length > 0 && bank.accounts[0].bankName) 
                    ? bank.accounts[0].bankName 
                    : bank.bankId;
                  
                  const bankColors: Record<string, { primary: string; secondary: string; light: string }> = {
                    vbank: { primary: '#1E3A8A', secondary: '#3B82F6', light: '#EFF6FF' },
                    sbank: { primary: '#047857', secondary: '#10B981', light: '#ECFDF5' },
                    abank: { primary: '#7C2D12', secondary: '#F97316', light: '#FFF7ED' },
                  };
                  const bankColor = bankColors[bank.bankId] || { 
                    primary: PAGE_STYLES.buttonBlue, 
                    secondary: PAGE_STYLES.buttonBlue,
                    light: '#F0F9FF'
                  };
                  const totalBankBalance = (bank.accounts || []).reduce((sum, acc) => {
                    const balance = parseFloat(String(acc.balance || acc.balances?.[0]?.amount || '0'));
                    return sum + (isNaN(balance) ? 0 : balance);
                  }, 0);
                  
                  const bankIncome = statisticsData?.bankIncomes?.[bank.bankId] || 0;
                  const bankExpense = statisticsData?.bankExpenses?.[bank.bankId] || 0;

                  return (
                    <Card
                      key={bank.bankId}
                      padding={0}
                      radius="md"
                      style={{
                        background: PAGE_STYLES.cardBackground,
                        border: `1px solid ${PAGE_STYLES.borderColor}`,
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        cursor: 'pointer',
                        overflow: 'hidden',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                        e.currentTarget.style.borderColor = bankColor.primary + '40';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                        e.currentTarget.style.borderColor = PAGE_STYLES.borderColor;
                      }}
                      onClick={() => setSelectedBankDetails(bank.bankId)}
                    >
                      <div
                        style={{
                          background: `linear-gradient(135deg, ${bankColor.primary} 0%, ${bankColor.secondary} 100%)`,
                          padding: '20px 24px',
                          position: 'relative',
                        }}
                      >
                        <Group justify="space-between" align="center">
                          <Stack gap={4} style={{ flex: 1 }}>
                            <Text 
                              fw={700} 
                              size="lg" 
                              style={{ 
                                color: '#FFFFFF',
                                fontSize: '18px',
                                letterSpacing: '-0.02em',
                                lineHeight: 1.2,
                                fontFamily: 'var(--font-inter), sans-serif',
                              }}
                            >
                              {bankName}
                            </Text>
                            <Text 
                              size="xs" 
                              style={{ 
                                color: 'rgba(255, 255, 255, 0.85)',
                                fontSize: '12px',
                                letterSpacing: '0.01em',
                                fontFamily: 'var(--font-inter), sans-serif',
                                fontWeight: 500,
                              }}
                            >
                              {(bank.accounts || []).length} {(() => {
                                const count = (bank.accounts || []).length;
                                if (count === 1) return 'счет';
                                if (count < 5) return 'счета';
                                return 'счетов';
                              })()}
                            </Text>
                          </Stack>
                          <Group gap="xs" align="center">
                            <Button
                              variant="subtle"
                              color="red"
                              size="xs"
                              p={4}
                              style={{
                                minWidth: 'auto',
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                background: 'rgba(255, 255, 255, 0.2)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(255, 255, 255, 0.3)',
                                color: '#FFFFFF',
                                cursor: 'pointer',
                              }}
                              onClick={(e) => handleDeleteBankClick(e, bank.bankId)}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
                                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                              }}
                            >
                              <IconX size={16} />
                            </Button>
                            <div
                              style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '14px',
                                background: 'rgba(255, 255, 255, 0.2)',
                                backdropFilter: 'blur(10px)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid rgba(255, 255, 255, 0.3)',
                              }}
                            >
                              <Text 
                                fw={700} 
                                size="xl" 
                                style={{ 
                                  color: '#FFFFFF',
                                  fontSize: '24px',
                                  letterSpacing: '-0.03em',
                                  fontFamily: 'var(--font-inter), sans-serif',
                                }}
                              >
                                {bankName.charAt(0).toUpperCase()}
                              </Text>
                            </div>
                          </Group>
                        </Group>
                      </div>

                      <Stack gap={0} style={{ padding: '24px' }}>
                        <div style={{ marginBottom: '20px' }}>
                          <Text 
                            size="xs" 
                            fw={600} 
                            c={PAGE_STYLES.textSecondary}
                            style={{ 
                              fontSize: '11px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              marginBottom: '8px',
                              fontFamily: 'var(--font-inter), sans-serif',
                            }}
                          >
                            Общий баланс
                          </Text>
                          <Text 
                            size="xl" 
                            fw={700} 
                            style={{ 
                              color: PAGE_STYLES.textPrimary,
                              fontSize: '28px',
                              letterSpacing: '-0.04em',
                              lineHeight: 1.1,
                              fontFamily: 'var(--font-inter), sans-serif',
                            }}
                          >
                            {formatBalance(totalBankBalance, 'RUB')}
                          </Text>
                        </div>
                        
                        {(bankIncome > 0 || bankExpense > 0) && (
                          <div 
                            style={{ 
                              padding: '16px',
                              background: bankColor.light,
                              borderRadius: '12px',
                              marginBottom: '20px',
                              border: `1px solid ${bankColor.primary}15`,
                            }}
                          >
                            <Group gap="lg" grow>
                              <Stack gap={4}>
                                <Text 
                                  size="xs" 
                                  fw={600} 
                                  c={PAGE_STYLES.textSecondary}
                                  style={{ 
                                    fontSize: '11px',
                                    letterSpacing: '0.01em',
                                    fontFamily: 'var(--font-inter), sans-serif',
                                  }}
                                >
                                  Доходы
                                </Text>
                                <Text 
                                  size="sm" 
                                  fw={700} 
                                  c={PAGE_STYLES.successGreen}
                                  style={{ 
                                    fontSize: '16px',
                                    letterSpacing: '-0.02em',
                                    fontFamily: 'var(--font-inter), sans-serif',
                                  }}
                                >
                                  {formatBalance(bankIncome, 'RUB')}
                                </Text>
                              </Stack>
                              <Stack gap={4}>
                                <Text 
                                  size="xs" 
                                  fw={600} 
                                  c={PAGE_STYLES.textSecondary}
                                  style={{ 
                                    fontSize: '11px',
                                    letterSpacing: '0.01em',
                                    fontFamily: 'var(--font-inter), sans-serif',
                                  }}
                                >
                                  Расходы
                                </Text>
                                <Text 
                                  size="sm" 
                                  fw={700} 
                                  c="#DC2626"
                                  style={{ 
                                    fontSize: '16px',
                                    letterSpacing: '-0.02em',
                                    fontFamily: 'var(--font-inter), sans-serif',
                                  }}
                                >
                                  {formatBalance(bankExpense, 'RUB')}
                                </Text>
                              </Stack>
                            </Group>
                          </div>
                        )}

                        {(bank.accounts || []).length > 0 ? (
                          <Stack gap={8}>
                            <Text 
                              size="xs" 
                              fw={600} 
                              c={PAGE_STYLES.textSecondary}
                              style={{ 
                                fontSize: '11px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                marginBottom: '4px',
                                fontFamily: 'var(--font-inter), sans-serif',
                              }}
                            >
                              Счета
                            </Text>
                            {(bank.accounts || []).map((account, index) => {
                              const balance = parseFloat(String(account.balance || account.balances?.[0]?.amount || '0'));
                              const availableBalance = parseFloat(String(account.availableBalance || account.balances?.[0]?.amount || '0'));
                              const accountName = account.accountName || account.nickname || account.accountNumber || 'Счет';
                              const accountNumber = account.accountNumber ? `****${account.accountNumber.slice(-4)}` : '';
                              const accountType = account.accountType || account.accountSubType || '';
                              const isActive = account.isActive !== false;
                              
                              return (
                                <div
                                  key={account.accountId || account.id}
                                  style={{
                                    padding: '16px',
                                    background: index % 2 === 0 ? PAGE_STYLES.paperBackground : PAGE_STYLES.cardBackground,
                                    borderRadius: '10px',
                                    border: `1px solid ${PAGE_STYLES.borderColor}`,
                                    transition: 'all 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = bankColor.light;
                                    e.currentTarget.style.borderColor = bankColor.primary + '30';
                                    e.currentTarget.style.transform = 'translateX(2px)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = index % 2 === 0 ? PAGE_STYLES.paperBackground : PAGE_STYLES.cardBackground;
                                    e.currentTarget.style.borderColor = PAGE_STYLES.borderColor;
                                    e.currentTarget.style.transform = 'translateX(0)';
                                  }}
                                >
                                  <Group justify="space-between" align="flex-start" gap="md">
                                    <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
                                      <Group gap="xs" align="center" wrap="nowrap">
                                        <Text 
                                          size="sm" 
                                          fw={600} 
                                          c={PAGE_STYLES.textPrimary}
                                          style={{ 
                                            fontSize: '14px',
                                            lineHeight: 1.4,
                                            letterSpacing: '-0.01em',
                                            fontFamily: 'var(--font-inter), sans-serif',
                                          }}
                                          truncate
                                        >
                                          {accountName}
                                        </Text>
                                        {isActive && (
                                          <Badge 
                                            size="xs" 
                                            color="green" 
                                            variant="light"
                                            style={{ 
                                              fontSize: '10px',
                                              height: '20px',
                                              padding: '0 8px',
                                              fontWeight: 600,
                                              fontFamily: 'var(--font-inter), sans-serif',
                                            }}
                                          >
                                            Активен
                                          </Badge>
                                        )}
                                      </Group>
                                      {accountNumber && (
                                        <Text 
                                          size="xs" 
                                          c={PAGE_STYLES.textSecondary}
                                          style={{ 
                                            fontSize: '12px',
                                            fontFamily: 'var(--font-mono), monospace',
                                            letterSpacing: '0.05em',
                                            opacity: 0.8,
                                          }}
                                        >
                                          {accountNumber}
                                        </Text>
                                      )}
                                      {accountType && (
                                        <Text 
                                          size="xs" 
                                          c={PAGE_STYLES.textSecondary}
                                          style={{ 
                                            fontSize: '12px',
                                            letterSpacing: '0.01em',
                                            fontFamily: 'var(--font-inter), sans-serif',
                                            fontWeight: 500,
                                          }}
                                        >
                                          {accountType}
                                        </Text>
                                      )}
                                    </Stack>
                                    <Stack gap={4} align="flex-end" style={{ flexShrink: 0 }}>
                                      <Text 
                                        size="sm" 
                                        fw={700} 
                                        style={{ 
                                          color: PAGE_STYLES.textPrimary,
                                          fontSize: '16px',
                                          whiteSpace: 'nowrap',
                                          letterSpacing: '-0.02em',
                                          fontFamily: 'var(--font-inter), sans-serif',
                                        }}
                                      >
                                        {formatBalance(balance, account.currency || 'RUB')}
                                      </Text>
                                      {availableBalance !== balance && availableBalance > 0 && (
                                        <Text 
                                          size="xs" 
                                          c={PAGE_STYLES.textSecondary}
                                          style={{ 
                                            fontSize: '11px',
                                            letterSpacing: '0.01em',
                                            fontFamily: 'var(--font-inter), sans-serif',
                                            fontWeight: 500,
                                          }}
                                        >
                                          Доступно: {formatBalance(availableBalance, account.currency || 'RUB')}
                                        </Text>
                                      )}
                                    </Stack>
                                  </Group>
                                </div>
                              );
                            })}
                          </Stack>
                        ) : (
                          <Center py="xl">
                            <Stack align="center" gap="xs">
                              <Text 
                                size="sm" 
                                c={PAGE_STYLES.textSecondary}
                                style={{ 
                                  fontSize: '14px',
                                  fontFamily: 'var(--font-inter), sans-serif',
                                  fontWeight: 500,
                                }}
                              >
                                Нет счетов
                              </Text>
                            </Stack>
                          </Center>
                        )}
                      </Stack>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Center py="xl">
                <Stack align="center" gap="xs">
                  <div
                    style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: '18px',
                      background: `${PAGE_STYLES.paperBackground}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '12px',
                      border: `2px solid ${PAGE_STYLES.borderColor}`,
                    }}
                  >
                    <IconInfoCircle size={36} color={PAGE_STYLES.textSecondary} />
                  </div>
                  <Text size="sm" fw={500} c={PAGE_STYLES.textPrimary}>
                    Нет подключенных банков
                  </Text>
                  <Text size="xs" c={PAGE_STYLES.textSecondary} style={{ opacity: 0.7 }}>
                    Подключите банк для просмотра счетов
                  </Text>
                </Stack>
              </Center>
            )}
          </Stack>
        </Card>

        <Card
          padding="xl"
          radius="xl"
          style={{
            background: PAGE_STYLES.cardBackground,
            border: `1px solid ${PAGE_STYLES.borderColor}`,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          <Stack gap="md">
            <Title order={3} size="h4" fw={600} c={PAGE_STYLES.textPrimary}>
              Доступные банки
            </Title>

            <TextInput
              placeholder="Поиск банка..."
              leftSection={<IconSearch size={16} />}
              value={bankSearchQuery}
              onChange={(e) => setBankSearchQuery(e.target.value)}
              size="sm"
            />

            {banksLoading ? (
              <Center py="md">
                <Loader size="sm" />
              </Center>
            ) : banksList.length > 0 ? (
              <Stack gap="xs">
                {banksList.map((bankId) => (
                  <Group
                    key={bankId}
                    justify="space-between"
                    p="sm"
                    style={{
                      backgroundColor: PAGE_STYLES.paperBackground,
                      borderRadius: 'var(--mantine-radius-md)',
                      border: `1px solid ${PAGE_STYLES.borderColor}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onClick={() => handleBankConnect(bankId)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#E9ECEF';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = PAGE_STYLES.paperBackground;
                    }}
                  >
                    <Text size="sm" fw={500} c={PAGE_STYLES.textPrimary}>
                      {bankId}
                    </Text>
                    <Button size="xs" variant="light">
                      Подключить
                    </Button>
                  </Group>
                ))}
                {banksData && banksData.banks.length > 5 && (
                  <Button
                    variant="subtle"
                    size="xs"
                    onClick={() => setBanksExpanded(!banksExpanded)}
                    rightSection={banksExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                  >
                    {banksExpanded ? 'Свернуть' : `Показать все (${banksData.banks.length})`}
                  </Button>
                )}
              </Stack>
            ) : (
              <Center py="md">
                <Text size="sm" c={PAGE_STYLES.textSecondary}>
                  Банки не найдены
                </Text>
              </Center>
            )}
          </Stack>
        </Card>
      </Stack>

      {consentModalOpen && selectedBank && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setConsentModalOpen(false)}
        >
          <Card
            padding="xl"
            radius="md"
            style={{
              background: PAGE_STYLES.cardBackground,
              maxWidth: '400px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Stack gap="md">
              <Title order={3} size="h4">
                Подключить {selectedBank}
              </Title>
              <Text size="sm" c={PAGE_STYLES.textSecondary}>
                Введите client_id для подключения банка. Если согласие недействительно, укажите правильный client_id (например, team052-3).
              </Text>
              <TextInput
                label="Client ID"
                placeholder="team052-3"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                description="Обязательно укажите, если пересоздаете согласие"
              />
              <Group justify="flex-end" gap="sm">
                <Button variant="subtle" onClick={() => setConsentModalOpen(false)}>
                  Отмена
                </Button>
                <Button onClick={handleConsentSubmit}>
                  Подключить
                </Button>
              </Group>
            </Stack>
          </Card>
        </div>
      )}

      {selectedBankDetails && (() => {
        const bank = accountsData?.banks?.find(b => b.bankId === selectedBankDetails);
        if (!bank) return null;
        
        const bankName = (bank.accounts && bank.accounts.length > 0 && bank.accounts[0].bankName) 
          ? bank.accounts[0].bankName 
          : bank.bankId;
        
        const bankColors: Record<string, { primary: string; secondary: string }> = {
          vbank: { primary: '#1E3A8A', secondary: '#3B82F6' },
          sbank: { primary: '#047857', secondary: '#10B981' },
          abank: { primary: '#7C2D12', secondary: '#F97316' },
        };
        const bankColor = bankColors[bank.bankId] || { primary: PAGE_STYLES.buttonBlue, secondary: PAGE_STYLES.buttonBlue };
        const bankIncome = statisticsData?.bankIncomes?.[bank.bankId] || 0;
        const bankExpense = statisticsData?.bankExpenses?.[bank.bankId] || 0;
        const totalBankBalance = (bank.accounts || []).reduce((sum, acc) => {
          const balance = parseFloat(String(acc.balance || acc.balances?.[0]?.amount || '0'));
          return sum + (isNaN(balance) ? 0 : balance);
        }, 0);
        
        const bankTransactions = allTransactions.filter(tx => 
          tx.bankId === bank.bankId || 
          (tx.account && tx.account.bankName === bank.bankId)
        ).slice(0, 10);
        
        return (
          <Modal
            opened={!!selectedBankDetails}
            onClose={() => setSelectedBankDetails(null)}
            title={
              <Group gap="md" align="center">
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: `${bankColor.primary}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `2px solid ${bankColor.primary}30`,
                  }}
                >
                  <Text fw={700} size="lg" style={{ color: bankColor.primary }}>
                    {bankName.charAt(0).toUpperCase()}
                  </Text>
                </div>
                <div>
                  <Text fw={600} size="lg" style={{ color: PAGE_STYLES.textPrimary }}>
                    {bankName}
                  </Text>
                  <Text size="xs" c={PAGE_STYLES.textSecondary}>
                    Детальная информация
                  </Text>
                </div>
              </Group>
            }
            size="xl"
            centered
          >
            <Stack gap="lg">
              <Card
                padding="lg"
                radius="md"
                style={{
                  background: `linear-gradient(135deg, ${bankColor.primary}08 0%, ${bankColor.secondary}05 100%)`,
                  border: `1px solid ${bankColor.primary}20`,
                }}
              >
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={4}>
                      <Text size="xs" c={PAGE_STYLES.textSecondary} fw={500} style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Общий баланс
                      </Text>
                      <Text size="xl" fw={700} style={{ color: PAGE_STYLES.textPrimary, fontSize: '28px' }}>
                        {formatBalance(totalBankBalance, 'RUB')}
                      </Text>
                    </Stack>
                    <Stack gap={4} align="flex-end">
                      <Text size="xs" c={PAGE_STYLES.textSecondary} fw={500} style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Счетов
                      </Text>
                      <Text size="xl" fw={700} style={{ color: bankColor.primary, fontSize: '28px' }}>
                        {(bank.accounts || []).length}
                      </Text>
                    </Stack>
                  </Group>
                  
                  {(bankIncome > 0 || bankExpense > 0) && (
                    <Group gap="lg" mt="md" style={{ paddingTop: '16px', borderTop: `1px solid ${bankColor.primary}20` }}>
                      <Stack gap={4} style={{ flex: 1 }}>
                        <Text size="xs" c={PAGE_STYLES.textSecondary} fw={500}>
                          Доходы
                        </Text>
                        <Text size="lg" fw={700} c={PAGE_STYLES.successGreen}>
                          {formatBalance(bankIncome, 'RUB')}
                        </Text>
                      </Stack>
                      <Stack gap={4} style={{ flex: 1 }}>
                        <Text size="xs" c={PAGE_STYLES.textSecondary} fw={500}>
                          Расходы
                        </Text>
                        <Text size="lg" fw={700} c="#EF4444">
                          {formatBalance(bankExpense, 'RUB')}
                        </Text>
                      </Stack>
                      <Stack gap={4} style={{ flex: 1 }}>
                        <Text size="xs" c={PAGE_STYLES.textSecondary} fw={500}>
                          Чистый доход
                        </Text>
                        <Text size="lg" fw={700} c={bankIncome - bankExpense >= 0 ? PAGE_STYLES.successGreen : '#EF4444'}>
                          {formatBalance(bankIncome - bankExpense, 'RUB')}
                        </Text>
                      </Stack>
                    </Group>
                  )}
                </Stack>
              </Card>

              <div>
                <Text size="sm" fw={600} c={PAGE_STYLES.textPrimary} style={{ marginBottom: '12px' }}>
                  Счета
                </Text>
                <Stack gap="sm">
                  {(bank.accounts || []).map((account) => {
                    const balance = parseFloat(String(account.balance || account.balances?.[0]?.amount || '0'));
                    const availableBalance = parseFloat(String(account.availableBalance || account.balances?.[0]?.amount || '0'));
                    const accountName = account.accountName || account.nickname || account.accountNumber || 'Счет';
                    const accountNumber = account.accountNumber || '';
                    const accountType = account.accountType || account.accountSubType || '';
                    const isActive = account.isActive !== false;
                    const status = account.status || '';
                    const openingDate = account.openingDate ? new Date(account.openingDate).toLocaleDateString('ru-RU') : null;
                    
                    return (
                      <Card
                        key={account.accountId || account.id}
                        padding="md"
                        radius="md"
                        style={{
                          background: PAGE_STYLES.paperBackground,
                          border: `1px solid ${PAGE_STYLES.borderColor}`,
                        }}
                      >
                        <Stack gap="sm">
                          <Group justify="space-between" align="flex-start">
                            <Stack gap={4} style={{ flex: 1 }}>
                              <Group gap="xs" align="center">
                                <Text size="sm" fw={600} c={PAGE_STYLES.textPrimary}>
                                  {accountName}
                                </Text>
                                {isActive && (
                                  <Badge size="xs" color="green" variant="light">
                                    Активен
                                  </Badge>
                                )}
                                {status && (
                                  <Badge size="xs" variant="light" color="blue">
                                    {status}
                                  </Badge>
                                )}
                              </Group>
                              {accountNumber && (
                                <Text size="xs" c={PAGE_STYLES.textSecondary} style={{ fontFamily: 'monospace' }}>
                                  {accountNumber}
                                </Text>
                              )}
                              {accountType && (
                                <Text size="xs" c={PAGE_STYLES.textSecondary}>
                                  Тип: {accountType}
                                </Text>
                              )}
                              {openingDate && (
                                <Text size="xs" c={PAGE_STYLES.textSecondary}>
                                  Открыт: {openingDate}
                                </Text>
                              )}
                            </Stack>
                            <Stack gap={4} align="flex-end">
                              <Text size="lg" fw={700} c={PAGE_STYLES.textPrimary}>
                                {formatBalance(balance, account.currency || 'RUB')}
                              </Text>
                              {availableBalance !== balance && availableBalance > 0 && (
                                <Text size="xs" c={PAGE_STYLES.textSecondary}>
                                  Доступно: {formatBalance(availableBalance, account.currency || 'RUB')}
                                </Text>
                              )}
                            </Stack>
                          </Group>
                        </Stack>
                      </Card>
                    );
                  })}
                </Stack>
              </div>

              {bankTransactions.length > 0 && (
                <div>
                  <Text size="sm" fw={600} c={PAGE_STYLES.textPrimary} style={{ marginBottom: '12px' }}>
                    Последние транзакции
                  </Text>
                  <Stack gap="xs">
                    {bankTransactions.map((transaction: any, index) => {
                      const transactionDate = transaction.date || transaction.bookingDateTime || transaction.valueDateTime;
                      const date = transactionDate ? new Date(transactionDate) : new Date();
                      const formattedDate = date.toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      
                      let amount = 0;
                      if (typeof transaction.amount === 'object' && transaction.amount?.amount) {
                        amount = parseFloat(String(transaction.amount.amount || '0'));
                      } else {
                        amount = parseFloat(String(transaction.amount || '0'));
                      }
                      
                      const isCredit = transaction.type === 'INCOME' || transaction.creditDebitIndicator === 'Credit';
                      const name = transaction.transactionInformation || transaction.description || 'Транзакция';
                      
                      return (
                        <Group key={transaction.uniqueKey || index} justify="space-between" align="center" p="xs" style={{
                          background: PAGE_STYLES.paperBackground,
                          borderRadius: '8px',
                          border: `1px solid ${PAGE_STYLES.borderColor}`,
                        }}>
                          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                            <Text size="sm" fw={500} c={PAGE_STYLES.textPrimary} truncate>
                              {name}
                            </Text>
                            <Text size="xs" c={PAGE_STYLES.textSecondary}>
                              {formattedDate}
                            </Text>
                          </Stack>
                          <Text size="sm" fw={700} c={isCredit ? PAGE_STYLES.successGreen : PAGE_STYLES.textPrimary}>
                            {isCredit ? '+' : '-'}{formatBalance(Math.abs(amount), transaction.currency || 'RUB')}
                          </Text>
                        </Group>
                      );
                    })}
                  </Stack>
                </div>
              )}
            </Stack>
          </Modal>
        );
      })()}

      <Modal
        opened={deleteBankModalOpen}
        onClose={() => {
          setDeleteBankModalOpen(false);
          setBankToDelete(null);
        }}
        title="Удаление банка"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Вы уверены, что хотите удалить банк <strong>{bankToDelete?.bankName}</strong>? Это действие нельзя отменить. Все данные о счетах и транзакциях этого банка будут удалены.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" onClick={() => {
              setDeleteBankModalOpen(false);
              setBankToDelete(null);
            }}>
              Отмена
            </Button>
            <Button color="red" leftSection={<IconX size={18} />} onClick={handleConfirmDeleteBank}>
              Удалить
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={transactionModalOpen}
        onClose={() => setTransactionModalOpen(false)}
        title="Детали транзакции"
        size="lg"
        centered
      >
        {selectedTransaction && (() => {
          const transactionDate = selectedTransaction.date || selectedTransaction.bookingDateTime || selectedTransaction.valueDateTime;
          const date = transactionDate ? new Date(transactionDate) : new Date();
          const formattedDate = date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          let amount = 0;
          if (typeof selectedTransaction.amount === 'object' && selectedTransaction.amount?.amount) {
            amount = parseFloat(String(selectedTransaction.amount.amount || '0'));
          } else {
            amount = parseFloat(String(selectedTransaction.amount || '0'));
          }

          const isCredit = selectedTransaction.creditDebitIndicator === 'Credit';
          const name = selectedTransaction.transactionInformation || selectedTransaction.name || selectedTransaction.description || 'Транзакция';
          const status = selectedTransaction.status || 'Unknown';
          const transactionCode = selectedTransaction.bankTransactionCode?.code || '';
          const transactionId = selectedTransaction.transactionId || selectedTransaction.id || 'N/A';
          const accountId = selectedTransaction.accountId || 'N/A';

          return (
            <Stack gap="md">
              <Group gap="md" align="flex-start">
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '16px',
                    background: isCredit
                      ? `${PAGE_STYLES.successGreen}15`
                      : `${PAGE_STYLES.accentOrange}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isCredit ? (
                    <IconArrowUpRight size={32} color={PAGE_STYLES.successGreen} />
                  ) : (
                    <IconArrowDownRight size={32} color={PAGE_STYLES.accentOrange} />
                  )}
                </div>
                <Stack gap={4} style={{ flex: 1 }}>
                  <Text size="lg" fw={700} c={PAGE_STYLES.textPrimary}>
                    {name}
                  </Text>
                  <Text
                    size="xl"
                    fw={700}
                    c={isCredit ? PAGE_STYLES.successGreen : PAGE_STYLES.textPrimary}
                  >
                    {isCredit ? '+' : '-'}{formatBalance(Math.abs(amount).toString(), selectedTransaction.amount?.currency || selectedTransaction.currency || 'RUB')}
                  </Text>
                </Stack>
              </Group>

              <Divider />

              <Stack gap="sm">
                <Group justify="space-between">
                  <Text size="sm" c={PAGE_STYLES.textSecondary} fw={500}>
                    Дата и время:
                  </Text>
                  <Text size="sm" fw={500} c={PAGE_STYLES.textPrimary}>
                    {formattedDate}
                  </Text>
                </Group>

                <Group justify="space-between">
                  <Text size="sm" c={PAGE_STYLES.textSecondary} fw={500}>
                    Статус:
                  </Text>
                  <Badge
                    size="sm"
                    variant="light"
                    color={status === 'Booked' ? 'green' : 'gray'}
                    leftSection={status === 'Booked' ? <IconCheck size={12} /> : null}
                  >
                    {status}
                  </Badge>
                </Group>

                <Group justify="space-between">
                  <Text size="sm" c={PAGE_STYLES.textSecondary} fw={500}>
                    Тип операции:
                  </Text>
                  <Text size="sm" fw={500} c={PAGE_STYLES.textPrimary}>
                    {isCredit ? 'Поступление' : 'Списание'}
                  </Text>
                </Group>

                {transactionCode && (
                  <Group justify="space-between">
                    <Text size="sm" c={PAGE_STYLES.textSecondary} fw={500}>
                      Код операции:
                    </Text>
                    <Text size="sm" fw={500} c={PAGE_STYLES.textPrimary} style={{ fontFamily: 'monospace' }}>
                      {transactionCode}
                    </Text>
                  </Group>
                )}

                <Group justify="space-between">
                  <Text size="sm" c={PAGE_STYLES.textSecondary} fw={500}>
                    ID транзакции:
                  </Text>
                  <Text size="sm" fw={500} c={PAGE_STYLES.textPrimary} style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                    {transactionId}
                  </Text>
                </Group>

                <Group justify="space-between">
                  <Text size="sm" c={PAGE_STYLES.textSecondary} fw={500}>
                    ID счета:
                  </Text>
                  <Text size="sm" fw={500} c={PAGE_STYLES.textPrimary} style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                    {accountId}
                  </Text>
                </Group>

                {selectedTransaction.bankId && (
                  <Group justify="space-between">
                    <Text size="sm" c={PAGE_STYLES.textSecondary} fw={500}>
                      Банк:
                    </Text>
                    <Text size="sm" fw={500} c={PAGE_STYLES.textPrimary}>
                      {selectedTransaction.account?.bankName || selectedTransaction.bankId || 'Неизвестно'}
                    </Text>
                  </Group>
                )}
              </Stack>
            </Stack>
          );
        })()}
      </Modal>
    </Container>
  );
}
