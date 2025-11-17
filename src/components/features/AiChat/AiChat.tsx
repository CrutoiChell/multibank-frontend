'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ActionIcon,
  Textarea,
  Button,
  Paper,
  Text,
  ScrollArea,
  Group,
  Stack,
  Loader,
  Box,
  Badge,
} from '@mantine/core';
import {
  IconMessageCircle,
  IconX,
  IconMinus,
  IconMaximize,
  IconSend,
  IconRobot,
  IconUser,
  IconCrown,
} from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useGetFinancialAdviceMutation,
  useGetRecommendationsQuery,
  useMarkRecommendationAsReadMutation,
  useDeleteAllRecommendationsMutation,
  useGetRelevantAdMutation,
  type Recommendation,
} from '@/lib/store/api/AiApi';
import { notifications } from '@mantine/notifications';
import classes from './AiChat.module.css';
import { useGetCurrentUserQuery } from '@/lib/store/api/UserApi';
import { formatMarkdown } from '@/lib/utils/formatMarkdown';
import { useGetUserAdsQuery } from '@/lib/store/api/AdsApi';
import type { Ad } from '@/lib/store/api/AdsApi';
import { PremiumModal } from './PremiumModal';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  recommendationId?: number;
  isRead?: boolean;
}

const STORAGE_KEY = 'ai-chat-history';
const ADS_STORAGE_KEY = 'user-ads';

export function AiChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [getFinancialAdvice] = useGetFinancialAdviceMutation();
  const [markAsRead] = useMarkRecommendationAsReadMutation();
  const [deleteAllRecommendations] = useDeleteAllRecommendationsMutation();
  const [getRelevantAd] = useGetRelevantAdMutation();
  const requestedAdsRef = useRef<Set<number>>(new Set());
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const readMessagesRef = useRef<Set<number>>(new Set());
  const [isClearing, setIsClearing] = useState(false);
  const [lastAd, setLastAd] = useState<{
    id: number;
    ads: string;
    url: string;
  } | null>(null);

  // Premium subscription state (temporary: hardcoded, will be replaced with API call)
  const [isPremium, setIsPremium] = useState(true);
  const [responseCount, setResponseCount] = useState(0);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  // Check if user is authenticated
  const { isSuccess: isAuthenticated } = useGetCurrentUserQuery();

  // Load recommendations from API (always when authenticated, to show unread count)
  const { data: recommendations, refetch: refetchRecommendations } =
    useGetRecommendationsQuery(undefined, { skip: !isAuthenticated });

  // Load user ads
  const { data: userAdsData, refetch: refetchUserAds } = useGetUserAdsQuery(
    undefined,
    { skip: !isAuthenticated },
  );

  // Обрабатываем рекламы пользователя и показываем последнюю
  useEffect(() => {
    if (userAdsData) {
      // Обрабатываем оба варианта: массив напрямую или объект с полем ads
      let adsArray: Ad[] = [];
      if (Array.isArray(userAdsData)) {
        adsArray = userAdsData;
      } else if (userAdsData.ads && Array.isArray(userAdsData.ads)) {
        adsArray = userAdsData.ads;
      }

      // Выбираем рекламу по lastViewedAt (самая новая или null)
      if (adsArray.length > 0) {
        const selectedAd = adsArray
          .filter((ad) => ad) // Фильтруем пустые значения
          .sort((a, b) => {
            // Сначала рекламы без lastViewedAt (null или undefined)
            if (!a.lastViewedAt && !b.lastViewedAt) return 0;
            if (!a.lastViewedAt) return -1; // a идет первым
            if (!b.lastViewedAt) return 1; // b идет первым

            // Затем сортируем по lastViewedAt (самая новая первая)
            const dateA = new Date(a.lastViewedAt).getTime();
            const dateB = new Date(b.lastViewedAt).getTime();
            return dateB - dateA; // Обратный порядок - самая новая первая
          })[0]; // Берем первую (самую новую или без lastViewedAt)

        if (selectedAd) {
          setLastAd({
            id: selectedAd.id,
            ads: selectedAd.ads,
            url: selectedAd.url || '#',
          });
        }
      }
    }
  }, [userAdsData]);

  // Convert recommendations to chat messages
  const convertRecommendationsToMessages = useCallback(
    (recs: Recommendation[]): ChatMessage[] => {
      // Создаем копию массива перед сортировкой, чтобы не мутировать read-only массив
      return [...recs]
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )
        .map((rec) => ({
          id: `rec-${rec.id}`,
          role: 'assistant' as const,
          content: rec.content,
          timestamp: new Date(rec.createdAt),
          recommendationId: rec.id,
          isRead: rec.isRead,
        }));
    },
    [],
  );

  // Load user questions from localStorage (only user messages, not AI responses)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const userMessages = parsed
          .filter((msg: any) => msg.role === 'user')
          .map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));
        setMessages((prev) => {
          // Merge with recommendations, but keep user messages from localStorage
          const existingIds = new Set(prev.map((m) => m.id));
          return [
            ...prev,
            ...userMessages.filter((m: ChatMessage) => !existingIds.has(m.id)),
          ];
        });
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  }, []);

  // Load recommendations when authenticated (for unread count and chat history)
  useEffect(() => {
    if (isAuthenticated && recommendations) {
      const recMessages = convertRecommendationsToMessages(recommendations);
      setMessages((prev) => {
        // Create a map of existing messages by recommendationId (for assistant messages)
        // and by id (for all messages)
        const existingById = new Map(prev.map((m) => [m.id, m]));
        const existingByRecId = new Map<number, ChatMessage>();
        prev.forEach((m) => {
          if (m.recommendationId) {
            existingByRecId.set(m.recommendationId, m);
          }
        });

        // Filter out recommendations that already exist
        const newRecMessages = recMessages.filter(
          (m) =>
            !existingById.has(m.id) &&
            (!m.recommendationId || !existingByRecId.has(m.recommendationId)),
        );

        // НЕ запрашиваем relevant-by-advice при загрузке рекомендаций из API
        // Запрос relevant-by-advice делается только один раз при отправке нового сообщения в чате
        // через /api/ai/financial-advice

        // Update existing recommendations with latest data (e.g., isRead status)
        const updated = prev.map((m) => {
          if (m.recommendationId) {
            const rec = recommendations.find(
              (r) => r.id === m.recommendationId,
            );
            if (rec) {
              return { ...m, isRead: rec.isRead, content: rec.content };
            }
          }
          return m;
        });

        // Combine and sort by timestamp
        const combined = [...updated, ...newRecMessages];
        const sorted = combined.sort(
          (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
        );

        // Если появились новые рекомендации, сбрасываем isLoading
        if (newRecMessages.length > 0) {
          setIsLoading(false);
        }

        return sorted;
      });
    }
  }, [isAuthenticated, recommendations, convertRecommendationsToMessages]);

  // Calculate unread count
  const unreadCount = messages.filter(
    (msg) => msg.role === 'assistant' && !msg.isRead && msg.recommendationId,
  ).length;

  // Save only user messages to localStorage
  useEffect(() => {
    const userMessages = messages.filter((msg) => msg.role === 'user');
    if (userMessages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userMessages));
      } catch (error) {
        console.error('Failed to save chat history:', error);
      }
    }
  }, [messages]);

  // Handle scroll to mark messages as read
  useEffect(() => {
    if (!scrollViewportRef.current || !isAuthenticated || !isOpen) return;

    const viewport = scrollViewportRef.current;
    let scrollTimeout: NodeJS.Timeout;

    const handleScroll = () => {
      // Debounce scroll events
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const scrollTop = viewport.scrollTop;
        const clientHeight = viewport.clientHeight;
        const scrollHeight = viewport.scrollHeight;

        // Check if scrolled to bottom (with 50px threshold)
        if (scrollHeight - scrollTop - clientHeight < 50) {
          // Find unread messages with recommendationId
          const unreadMessages = messages.filter(
            (msg) =>
              msg.role === 'assistant' &&
              msg.recommendationId &&
              !msg.isRead &&
              !readMessagesRef.current.has(msg.recommendationId),
          );

          // Mark all visible unread messages as read
          if (unreadMessages.length > 0) {
            Promise.all(
              unreadMessages.map(async (msg) => {
                if (
                  msg.recommendationId &&
                  !readMessagesRef.current.has(msg.recommendationId)
                ) {
                  readMessagesRef.current.add(msg.recommendationId);
                  try {
                    await markAsRead(msg.recommendationId).unwrap();
                    return msg.id;
                  } catch (error) {
                    console.error('Failed to mark message as read:', error);
                    readMessagesRef.current.delete(msg.recommendationId);
                    return null;
                  }
                }
                return null;
              }),
            ).then((markedIds) => {
              // Update messages that were successfully marked as read
              const successIds = markedIds.filter(
                (id) => id !== null,
              ) as string[];
              if (successIds.length > 0) {
                setMessages((prev) =>
                  prev.map((m) =>
                    successIds.includes(m.id) ? { ...m, isRead: true } : m,
                  ),
                );
                // Refetch recommendations to update the list
                refetchRecommendations();
              }
            });
          }
        }
      }, 300); // 300ms debounce
    };

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      clearTimeout(scrollTimeout);
      viewport.removeEventListener('scroll', handleScroll);
    };
  }, [messages, isAuthenticated, isOpen, markAsRead, refetchRecommendations]);

  // Auto-scroll to bottom when new messages arrive or when ad appears
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, lastAd]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !isAuthenticated) {
      if (!isAuthenticated) {
        notifications.show({
          color: 'yellow',
          title: 'Требуется авторизация',
          message:
            'Пожалуйста, войдите в систему для использования Ивана Банкова',
        });
      }
      return;
    }

    // Check premium limit for non-premium users
    if (!isPremium && responseCount >= 1) {
      notifications.show({
        color: 'yellow',
        title: 'Премиум подписка',
        message: 'Для продолжения использования приобретите премиум подписку',
      });
      setShowPremiumModal(true);
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const prompt = input.trim();
    setInput('');
    setIsLoading(true);

    // Сохраняем ID пользовательского сообщения для отслеживания
    const userMessageId = userMessage.id;
    let hasReceivedResponse = false;

    try {
      const response = await getFinancialAdvice({ prompt }).unwrap();
      hasReceivedResponse = true;

      // Извлекаем данные из нового формата ответа
      const advice = response.message || response.advice || '';
      const recommendationId =
        response.recommendation?.id || response.recommendationId;

      console.log('AiChat: response structure', {
        hasRecommendation: !!response.recommendation,
        recommendationId,
        hasMessage: !!response.message,
        hasAdvice: !!response.advice,
      });

      // Проверяем, что ответ не пустой
      if (
        !advice ||
        advice.trim() === '' ||
        advice.trim() === 'Извините, не удалось получить ответ.'
      ) {
        console.log(
          'AiChat: empty or error advice in response, waiting for recommendations',
        );
        // Не показываем ошибку, ждем ответ через recommendations
        setIsLoading(false);
        // Refetch recommendations чтобы получить ответ
        refetchRecommendations();
        return;
      }

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: advice,
        timestamp: new Date(),
        recommendationId: recommendationId,
        isRead: false, // New messages are unread by default
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);

      // Premium logic: increment response count and show modal after first response
      if (!isPremium) {
        const newResponseCount = responseCount + 1;
        setResponseCount(newResponseCount);

        // Show premium modal after first response
        if (newResponseCount === 1) {
          // Delay modal to let user see the response first
          setTimeout(() => {
            setShowPremiumModal(true);
          }, 1000);
        }
      }

      // СРАЗУ отправляем запрос на /ads/relevant-by-advice с recommendationId (только если ответ не пустой)
      console.log('AiChat: recommendationId', recommendationId);
      console.log(
        'AiChat: requestedAdsRef.current',
        Array.from(requestedAdsRef.current),
      );
      console.log('AiChat: has recommendationId?', !!recommendationId);
      console.log(
        'AiChat: already requested?',
        recommendationId
          ? requestedAdsRef.current.has(recommendationId)
          : false,
      );

      if (recommendationId && !requestedAdsRef.current.has(recommendationId)) {
        requestedAdsRef.current.add(recommendationId);
        console.log(
          'AiChat: requesting ad for recommendation',
          recommendationId,
        );
        // Запрашиваем рекламу асинхронно, не блокируя UI
        // Это единственное место, где запрашивается relevant-by-advice
        getRelevantAd({ recommendationId: recommendationId })
          .unwrap()
          .then((ad) => {
            console.log('AiChat: received ad', ad);
            // Сохраняем рекламу из ответа сразу, даже если пользователь уже прочитал сообщение
            if (ad && ad.ads) {
              // Сохраняем рекламу для показа в чате
              setLastAd({
                id: ad.id,
                ads: ad.ads,
                url: ad.url || '#',
              });

              // Сохраняем рекламу в localStorage для AdsModal
              try {
                // Получаем существующие рекламы из localStorage
                const savedAds = localStorage.getItem(ADS_STORAGE_KEY);
                let adsArray: Ad[] = savedAds ? JSON.parse(savedAds) : [];

                // Проверяем, нет ли уже этой рекламы в массиве
                const existingIndex = adsArray.findIndex((a) => a.id === ad.id);
                if (existingIndex >= 0) {
                  // Обновляем существующую рекламу
                  adsArray[existingIndex] = ad;
                } else {
                  // Добавляем новую рекламу в конец массива
                  adsArray.push(ad);
                }

                // Сохраняем обновленный массив в localStorage
                localStorage.setItem(ADS_STORAGE_KEY, JSON.stringify(adsArray));
                console.log('AiChat: saved ad to localStorage', {
                  ad,
                  adsArray,
                });

                // Отправляем событие для обновления AdsModal
                window.dispatchEvent(
                  new CustomEvent('new-ad-received', { detail: ad }),
                );
                // Также отправляем событие об обновлении localStorage
                window.dispatchEvent(new CustomEvent('localStorage-updated'));
              } catch (error) {
                console.error('Failed to save ad to localStorage:', error);
              }
            }
            // После запроса relevant-by-advice обновляем список реклам пользователя через /ads/user
            refetchUserAds();
          })
          .catch((error) => {
            console.error('Failed to get relevant ad:', error);
            // Удаляем из множества, чтобы можно было повторить попытку
            if (recommendationId) {
              requestedAdsRef.current.delete(recommendationId);
            }
          });
      } else {
        console.log(
          'AiChat: NOT requesting ad - recommendationId:',
          recommendationId,
          'already requested:',
          recommendationId
            ? requestedAdsRef.current.has(recommendationId)
            : false,
        );
      }

      // Refetch recommendations to get updated list
      refetchRecommendations();
    } catch (error: any) {
      console.error('Error getting financial advice:', error);

      // Не показываем ошибку сразу, если это может быть таймаут
      // Ответ может прийти позже через recommendations
      // Проверяем, есть ли уже ответ через recommendations
      const hasRecommendation = recommendations?.some(
        (rec) => rec.content && rec.content.trim() !== '',
      );

      // Если есть рекомендация с контентом, не показываем ошибку
      if (hasRecommendation) {
        console.log(
          'AdsModal: recommendation already exists, not showing error',
        );
        setIsLoading(false);
        return;
      }

      let errorMessage = 'Не удалось получить финансовый совет';
      let showInChat = false;

      // Если есть сообщение от сервера, используем его
      if (error?.data?.message) {
        errorMessage = error.data.message;
        // Показываем сообщение в чате, если это бизнес-логика (например, нет транзакций)
        showInChat = true;
      } else if (error?.status === 401) {
        errorMessage = 'Требуется авторизация. Пожалуйста, войдите в систему.';
      } else if (error?.status === 404 && !error?.data?.message) {
        // Только если это настоящая 404 без сообщения
        errorMessage =
          'Эндпоинт не найден. Убедитесь, что сервер запущен и перезапустите dev сервер.';
      } else if (error?.status === 500) {
        errorMessage = 'Ошибка сервера. Попробуйте позже.';
        showInChat = true;
      } else {
        // Для других ошибок (таймаут и т.д.) не показываем ошибку сразу
        // Ответ может прийти позже через recommendations
        console.log(
          'AdsModal: request may be processing, waiting for recommendations',
        );
        setIsLoading(false);
        // Продолжаем ждать ответ через recommendations
        return;
      }

      // Показываем уведомление только для критических ошибок
      if (
        error?.status === 401 ||
        (error?.status === 404 && !error?.data?.message)
      ) {
        notifications.show({
          color:
            error?.status === 404 && error?.data?.message ? 'yellow' : 'red',
          title:
            error?.status === 404 && error?.data?.message
              ? 'Информация'
              : 'Ошибка',
          message: errorMessage,
        });
      }

      // Показываем сообщение в чате только для бизнес-логики
      if (showInChat) {
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: errorMessage,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, errorMsg]);
      }
    } finally {
      // Не сбрасываем isLoading сразу, если ответ может прийти позже
      // setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (isClearing) return;
    if (!isAuthenticated) {
      setMessages([]);
      // Очищаем множество запрошенных реклам
      requestedAdsRef.current.clear();
      // Очищаем последнюю рекламу
      setLastAd(null);
      // Сбрасываем счетчик ответов для не-премиум пользователей
      setResponseCount(0);
      localStorage.removeItem(STORAGE_KEY);
      notifications.show({
        color: 'blue',
        title: 'История очищена',
        message: 'Локальная история чата была удалена',
      });
      return;
    }

    try {
      setIsClearing(true);
      // Optimistic UI: clear all messages immediately (including user messages)
      setMessages([]);
      // Очищаем множество запрошенных реклам
      requestedAdsRef.current.clear();
      // Очищаем последнюю рекламу
      setLastAd(null);
      // Сбрасываем счетчик ответов для не-премиум пользователей
      setResponseCount(0);
      await deleteAllRecommendations().unwrap();
      localStorage.removeItem(STORAGE_KEY);
      notifications.show({
        color: 'blue',
        title: 'История очищена',
        message: 'Все советы были удалены',
      });
      refetchRecommendations();
    } catch (error: any) {
      notifications.show({
        color: 'red',
        title: 'Ошибка',
        message: error?.data?.message || 'Не удалось удалить рекомендации',
      });
      // Подтянем актуальное состояние с сервера
      refetchRecommendations();
    } finally {
      setIsClearing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Bubble Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className={classes.bubbleContainer}
          >
            <ActionIcon
              size={60}
              radius="xl"
              variant="gradient"
              gradient={{ from: '#1e3a8a', to: '#3b82f6' }}
              onClick={() => setIsOpen(true)}
              className={classes.bubble}
              style={{ position: 'relative' }}
            >
              <IconMessageCircle size={28} />
              {unreadCount > 0 && isAuthenticated && (
                <Badge
                  size="lg"
                  circle
                  color="red"
                  variant="filled"
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    minWidth: 24,
                    height: 24,
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </ActionIcon>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={classes.modalOverlay}
            onClick={() => !isMinimized && setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 20, opacity: 0 }}
              animate={{
                scale: isMinimized ? 0.95 : 1,
                y: isMinimized ? 40 : 0,
                opacity: 1,
              }}
              exit={{ scale: 0.8, y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className={classes.modalContent}
            >
              <Paper
                shadow="xl"
                radius="md"
                className={classes.chatPaper}
                style={{
                  height: isMinimized ? 'auto' : '600px',
                  minHeight: isMinimized ? 'auto' : '600px',
                }}
              >
                {/* Header */}
                <Group
                  justify="space-between"
                  p="md"
                  className={classes.chatHeader}
                >
                  <Group gap="xs">
                    <IconRobot size={24} color="#1e3a8a" />
                    <div>
                      <Group gap="xs" align="center">
                        <Text fw={600} size="lg">
                          Иван Банков
                        </Text>
                        {isPremium && (
                          <Badge
                            leftSection={<IconCrown size={12} />}
                            variant="gradient"
                            gradient={{ from: '#FFD700', to: '#FFA500' }}
                            size="sm"
                          >
                            Premium
                          </Badge>
                        )}
                        {!isPremium && (
                          <Badge variant="light" color="gray" size="sm">
                            Обычный
                          </Badge>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed">
                        Ai agent
                      </Text>
                    </div>
                  </Group>
                  <Group gap="xs">
                    {!isMinimized && messages.length > 0 && (
                      <Button
                        size="xs"
                        variant="subtle"
                        onClick={handleClearHistory}
                        disabled={isClearing}
                      >
                        Очистить
                      </Button>
                    )}
                    <ActionIcon
                      variant="subtle"
                      onClick={() => setIsMinimized(!isMinimized)}
                      title={isMinimized ? 'Развернуть' : 'Свернуть'}
                    >
                      {isMinimized ? (
                        <IconMaximize size={18} />
                      ) : (
                        <IconMinus size={18} />
                      )}
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      onClick={() => setIsOpen(false)}
                    >
                      <IconX size={18} />
                    </ActionIcon>
                  </Group>
                </Group>

                {!isMinimized && (
                  <>
                    {/* Messages Area */}
                    <ScrollArea
                      h={400}
                      p="md"
                      ref={scrollAreaRef}
                      viewportRef={scrollViewportRef}
                      className={classes.messagesArea}
                    >
                      <Stack gap="md">
                        {messages.length === 0 ? (
                          <Box ta="center" py="xl">
                            <IconRobot
                              size={48}
                              color="#1e3a8a"
                              style={{ opacity: 0.3 }}
                            />
                            <Text c="dimmed" mt="md">
                              {isAuthenticated
                                ? 'Задайте вопрос о финансах, и я помогу вам!'
                                : 'Войдите в систему, чтобы использовать Ивана Банкова'}
                            </Text>
                          </Box>
                        ) : (
                          messages.map((message) => (
                            <motion.div
                              key={message.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <Stack
                                gap="xs"
                                style={{ width: '100%', maxWidth: '80%' }}
                              >
                                <Group
                                  align="flex-start"
                                  gap="sm"
                                  style={{
                                    flexDirection:
                                      message.role === 'user'
                                        ? 'row-reverse'
                                        : 'row',
                                  }}
                                >
                                  <Paper
                                    p="md"
                                    radius="md"
                                    style={{
                                      maxWidth: '100%',
                                      background:
                                        message.role === 'user'
                                          ? 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)'
                                          : undefined,
                                      color:
                                        message.role === 'user'
                                          ? 'white'
                                          : 'inherit',
                                      border:
                                        message.role === 'assistant' &&
                                        !message.isRead
                                          ? '2px solid #3b82f6'
                                          : undefined,
                                    }}
                                    bg={
                                      message.role === 'user'
                                        ? undefined
                                        : 'gray.1'
                                    }
                                  >
                                    <Group
                                      gap="xs"
                                      mb="xs"
                                      justify="space-between"
                                    >
                                      <Group gap="xs">
                                        {message.role === 'user' ? (
                                          <IconUser size={16} />
                                        ) : (
                                          <IconRobot size={16} />
                                        )}
                                        <Text size="xs" fw={500}>
                                          {message.role === 'user'
                                            ? 'Вы'
                                            : 'Иван Банков'}
                                        </Text>
                                      </Group>
                                      {message.role === 'assistant' &&
                                        !message.isRead && (
                                          <Badge
                                            size="xs"
                                            color="blue"
                                            variant="light"
                                          >
                                            Новое
                                          </Badge>
                                        )}
                                    </Group>
                                    <div style={{ fontSize: '0.875rem' }}>
                                      {formatMarkdown(message.content)}
                                    </div>
                                  </Paper>
                                </Group>
                                {/* Premium button under assistant messages */}
                                {message.role === 'assistant' && !isPremium && (
                                  <Button
                                    size="xs"
                                    variant="gradient"
                                    leftSection={<IconCrown size={14} />}
                                    onClick={() => setShowPremiumModal(true)}
                                    style={{
                                      alignSelf:
                                        message.role === 'assistant'
                                          ? 'flex-start'
                                          : 'flex-end',
                                      marginTop: '4px',
                                    }}
                                    gradient={{
                                      from: '#FFD700',
                                      to: '#FFA500',
                                    }}
                                  >
                                    Купить Premium
                                  </Button>
                                )}
                              </Stack>
                            </motion.div>
                          ))
                        )}
                        {isLoading && (
                          <Group align="flex-start" gap="sm">
                            <Paper p="md" radius="md" bg="gray.1">
                              <Group gap="xs">
                                <Loader size="sm" />
                                <Text size="sm" c="dimmed">
                                  Думаю...
                                </Text>
                              </Group>
                            </Paper>
                          </Group>
                        )}
                        {/* Показываем последнюю рекламу */}
                        {lastAd && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <Paper
                              p="md"
                              radius="md"
                              bg="gray.2"
                              style={{ position: 'relative' }}
                            >
                              <Group
                                justify="space-between"
                                align="flex-start"
                                gap="sm"
                              >
                                <Text size="sm" style={{ flex: 1 }}>
                                  {lastAd.ads}
                                </Text>
                                <ActionIcon
                                  variant="subtle"
                                  size="sm"
                                  onClick={() => setLastAd(null)}
                                  style={{ flexShrink: 0 }}
                                >
                                  <IconX size={16} />
                                </ActionIcon>
                              </Group>
                            </Paper>
                          </motion.div>
                        )}
                        <div ref={messagesEndRef} />
                      </Stack>
                    </ScrollArea>

                    {/* Input Area */}
                    <Box p="md" className={classes.inputArea}>
                      <Group gap="sm" align="flex-end">
                        <Textarea
                          placeholder={
                            isAuthenticated
                              ? 'Задайте вопрос о финансах...'
                              : 'Войдите в систему для использования'
                          }
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={handleKeyPress}
                          minRows={1}
                          maxRows={4}
                          autosize
                          style={{ flex: 1 }}
                          disabled={isLoading || !isAuthenticated}
                        />
                        <Button
                          onClick={handleSend}
                          disabled={
                            !input.trim() || isLoading || !isAuthenticated
                          }
                          variant="gradient"
                          gradient={{ from: '#1e3a8a', to: '#3b82f6' }}
                          leftSection={<IconSend size={18} />}
                        >
                          Отправить
                        </Button>
                      </Group>
                    </Box>
                  </>
                )}
              </Paper>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium Modal */}
      <PremiumModal
        opened={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        onUpgrade={() => {
          // TODO: Replace with actual premium purchase logic
          setIsPremium(true);
          setShowPremiumModal(false);
          notifications.show({
            color: 'green',
            title: 'Премиум активирован!',
            message: 'Теперь у вас есть неограниченный доступ к AI ассистенту',
          });
        }}
      />
    </>
  );
}
