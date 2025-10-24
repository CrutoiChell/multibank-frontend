'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Container,
  Grid,
  Card,
  Text,
  Avatar,
  Group,
  Stack,
  Badge,
  Button,
  Divider,
  SimpleGrid,
  Paper,
  Title,
  ActionIcon,
  Menu,
  rem,
  ThemeIcon,
  Modal,
  TextInput,
  Textarea,
  Select,
  Alert,
  Loader,
  Center,
} from '@mantine/core';
import {
  IconUser,
  IconSettings,
  IconCreditCard,
  IconWallet,
  IconChartBar,
  IconBell,
  IconDots,
  IconEdit,
  IconLogout,
  IconShield,
  IconHistory,
  IconStar,
  IconUpload,
  IconAlertCircle,
  IconCheck,
} from '@tabler/icons-react';
import { useProfile } from '@/lib/hooks/useProfile';
import { useLogoutMutation } from '@/lib/store/api/AuthApi';
import { userApi } from '@/lib/store/api/UserApi';
import { authApi } from '@/lib/store/api/AuthApi';
import { useDispatch } from 'react-redux';

export default function ProfilePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notifications, setNotifications] = useState({
    email: true,
    sms: true,
    push: true,
    security: true,
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    birthDate: '',
    gender: '' as 'MALE' | 'FEMALE' | 'OTHER' | '',
  });

  const {
    user,
    profile,
    isLoading,
    error,
    handleUpdateUser,
    handleUpdateProfile,
    handleUploadAvatar,
    getFullName,
    getInitials,
    hasAvatar,
    formatDate,
    formatBirthDate,
  } = useProfile();

  const [logout, { isLoading: logoutLoading }] = useLogoutMutation();
  const dispatch = useDispatch();
  useEffect(() => {
    if (profile) {
      setEditFormData({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        phone: user?.phone || '',
        birthDate: profile.birthDate ? profile.birthDate.split('T')[0] : '',
        gender: profile.gender || '',
      });
    }
  }, [profile, user]);

  const toggleNotification = (type: keyof typeof notifications) => {
    setNotifications(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const handleSaveProfile = async () => {
    try {
      setEditError(null);
      
      if (user) {
        await handleUpdateUser({
          phone: editFormData.phone,
        });
      }

      await handleUpdateProfile({
        firstName: editFormData.firstName,
        lastName: editFormData.lastName,
        birthDate: editFormData.birthDate ? new Date(editFormData.birthDate).toISOString() : undefined,
        gender: editFormData.gender || undefined,
      });

      setIsEditModalOpen(false);
    } catch (error: any) {
      console.error('Ошибка при сохранении профиля:', error);
      console.error('Детали ошибки:', JSON.stringify(error, null, 2));
      
      const errorMessage = error?.data?.message || error?.message || 'Произошла ошибка при сохранении профиля';
      setEditError(errorMessage);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        await handleUploadAvatar(file);
      } catch (error) {
        console.error('Ошибка при загрузке аватара:', error);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logout().unwrap();
      
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      
      document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      
      dispatch(userApi.util.resetApiState());
      dispatch(authApi.util.resetApiState());
      
      window.location.href = '/login';
    } catch (error) {
      console.error('Ошибка при выходе:', error);
    }
  };

  if (isLoading && !user && !profile) {
    return (
      <Container size="xl" py="xl">
        <Center h={400}>
          <Stack align="center" gap="md">
            <Loader size="lg" />
          </Stack>
        </Center>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Ошибка" color="red">
          {typeof error === 'string' ? error : 'Произошла ошибка при загрузке данных'}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <div></div>
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <ActionIcon variant="subtle" size="lg">
                    <IconDots size={20} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item leftSection={<IconSettings size={14} />}>Настройки</Menu.Item>
                  <Menu.Item leftSection={<IconBell size={14} />}>Уведомления</Menu.Item>
                  <Menu.Divider />
                  <Menu.Item 
                    leftSection={<IconLogout size={14} />} 
                    color="red"
                    onClick={handleLogout}
                    disabled={logoutLoading}
                  >
                    {logoutLoading ? 'Выход...' : 'Выйти'}
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
            <Stack align="center" gap="md">
              <div
                style={{
                  position: 'relative',
                  cursor: 'pointer',
                  display: 'inline-block'
                }}
                onMouseEnter={(e) => {
                  const overlay = e.currentTarget.querySelector('.avatar-overlay') as HTMLElement;
                  if (overlay) overlay.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  const overlay = e.currentTarget.querySelector('.avatar-overlay') as HTMLElement;
                  if (overlay) overlay.style.opacity = '0';
                }}
                onClick={() => {
                  fileInputRef.current?.click();
                }}
              >
                <Avatar 
                  size={120} 
                  radius="xl" 
                  color="blue"
                  src={hasAvatar() ? profile?.avatar : undefined}
                >
                  {hasAvatar() ? null : <IconUser size={60} />}
                </Avatar>
                <div
                  className="avatar-overlay"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    borderRadius: '27px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0,
                    transition: 'opacity 0.2s ease',
                    pointerEvents: 'none'
                  }}
                >
                  <IconUpload size={30} color="white" />
                </div>
              </div>
              
              <Stack align="center" gap="xs">
                <Title order={3}>{getFullName()}</Title>
                <Text size="sm" c="dimmed">{user?.email}</Text>
                <Badge color={user?.isActive ? "green" : "red"} variant="light">
                  {user?.isActive ? "Активный" : "Неактивный"}
                </Badge>
              </Stack>

              <Divider w="100%" />

              <Group justify="space-between" w="100%">
                <Text size="sm" fw={500}>ID пользователя</Text>
                <Text size="sm" c="dimmed">#{user?.id}</Text>
              </Group>

              <Group justify="space-between" w="100%">
                <Text size="sm" fw={500}>Дата регистрации</Text>
                <Text size="sm" c="dimmed">{formatDate(user?.createdAt)}</Text>
              </Group>

              <Group justify="space-between" w="100%">
                <Text size="sm" fw={500}>Телефон</Text>
                <Text size="sm" c="dimmed">{user?.phone || 'Не указан'}</Text>
              </Group>

              {profile?.birthDate && (
                <Group justify="space-between" w="100%">
                  <Text size="sm" fw={500}>Дата рождения</Text>
                  <Text size="sm" c="dimmed">{formatBirthDate(profile.birthDate)}</Text>
                </Group>
              )}

              <Button 
                fullWidth 
                variant="light" 
                leftSection={<IconEdit size={16} />}
                onClick={() => {
                  setEditError(null);
                  setIsEditModalOpen(true);
                }}
              >
                Редактировать профиль
              </Button>
            </Stack>
          </Card>

          <Card shadow="sm" padding="lg" radius="md" withBorder mt="md">
            <Title order={4} mb="md">Быстрые действия</Title>
            <Stack gap="sm">
              <Button variant="subtle" leftSection={<IconHistory size={16} />} justify="start">
                История операций
              </Button>
              <Button variant="subtle" leftSection={<IconChartBar size={16} />} justify="start">
                Статистика
              </Button>
              <Button variant="subtle" leftSection={<IconBell size={16} />} justify="start">
                Уведомления
              </Button>
              <Button variant="subtle" leftSection={<IconUser size={16} />} justify="start">
                Поддержка
              </Button>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 8 }}>
          
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} mb="xl">
            <Paper p="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="xs" tt="uppercase" fw={700} c="dimmed">Общий баланс</Text>
                  <Text fw={700} size="xl">Скоро</Text>
                </div>
                <ThemeIcon color="blue" variant="light" size="lg">
                  <IconWallet size={20} />
                </ThemeIcon>
              </Group>
            </Paper>
            <Paper p="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="xs" tt="uppercase" fw={700} c="dimmed">Карты</Text>
                  <Text fw={700} size="xl">Скоро</Text>
                </div>
                <ThemeIcon color="green" variant="light" size="lg">
                  <IconCreditCard size={20} />
                </ThemeIcon>
              </Group>
            </Paper>
            <Paper p="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="xs" tt="uppercase" fw={700} c="dimmed">Операции</Text>
                  <Text fw={700} size="xl">Скоро</Text>
                </div>
                <ThemeIcon color="orange" variant="light" size="lg">
                  <IconChartBar size={20} />
                </ThemeIcon>
              </Group>
            </Paper>
            <Paper p="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="xs" tt="uppercase" fw={700} c="dimmed">Что то там </Text>
                  <Text fw={700} size="xl">Скоро</Text>
                </div>
                <ThemeIcon color="yellow" variant="light" size="lg">
                  <IconStar size={20} />
                </ThemeIcon>
              </Group>
            </Paper>
          </SimpleGrid>

          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Title order={4}>Последние транзакции</Title>
              <Button variant="subtle" size="sm">Все операции</Button>
            </Group>

            <Stack gap="sm">
              <Group justify="space-between" p="sm" style={{ backgroundColor: 'var(--mantine-color-gray-0)', borderRadius: 'var(--mantine-radius-sm)' }}>
                <Group gap="sm">
                  <ThemeIcon color="green" variant="light" size="sm">
                    <IconWallet size={16} />
                  </ThemeIcon>
                  <div>
                    <Text size="sm" fw={500}>Пополнение счета</Text>
                    <Text size="xs" c="dimmed">Переводы</Text>
                  </div>
                </Group>
                <Text fw={700} c="green">+₽ 5,000</Text>
              </Group>

              <Group justify="space-between" p="sm">
                <Group gap="sm">
                  <ThemeIcon color="red" variant="light" size="sm">
                    <IconCreditCard size={16} />
                  </ThemeIcon>
                  <div>
                    <Text size="sm" fw={500}>Магнит</Text>
                    <Text size="xs" c="dimmed">Супермаркеты</Text>
                  </div>
                </Group>
                <Text fw={700} c="red">-₽ 1,250</Text>
              </Group>

              <Group justify="space-between" p="sm" style={{ backgroundColor: 'var(--mantine-color-gray-0)', borderRadius: 'var(--mantine-radius-sm)' }}>
                <Group gap="sm">
                  <ThemeIcon color="blue" variant="light" size="sm">
                    <IconWallet size={16} />
                  </ThemeIcon>
                  <div>
                    <Text size="sm" fw={500}>Перевод между счетами</Text>
                    <Text size="xs" c="dimmed">Переводы</Text>
                  </div>
                </Group>
                <Text fw={700} c="blue">₽ 3,000</Text>
              </Group>
            </Stack>
          </Card>

          <Card shadow="sm" padding="lg" radius="md" withBorder mt="md">
            <Title order={4} mb="md">Настройки уведомлений</Title>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Group justify="space-between">
                <div>
                  <Text size="sm" fw={500}>Email уведомления</Text>
                  <Text size="xs" c="dimmed">Получать уведомления на email</Text>
                </div>
                <Button 
                  size="xs" 
                  variant={notifications.email ? "light" : "outline"}
                  color={notifications.email ? "blue" : "gray"}
                  onClick={() => toggleNotification('email')}
                >
                  {notifications.email ? 'Включено' : 'Выключено'}
                </Button>
              </Group>

              <Group justify="space-between">
                <div>
                  <Text size="sm" fw={500}>SMS уведомления</Text>
                  <Text size="xs" c="dimmed">Получать SMS о операциях</Text>
                </div>
                <Button 
                  size="xs" 
                  variant={notifications.sms ? "light" : "outline"}
                  color={notifications.sms ? "blue" : "gray"}
                  onClick={() => toggleNotification('sms')}
                >
                  {notifications.sms ? 'Включено' : 'Выключено'}
                </Button>
              </Group>

              <Group justify="space-between">
                <div>
                  <Text size="sm" fw={500}>Push уведомления</Text>
                  <Text size="xs" c="dimmed">Уведомления в приложении</Text>
                </div>
                <Button 
                  size="xs" 
                  variant={notifications.push ? "light" : "outline"}
                  color={notifications.push ? "blue" : "gray"}
                  onClick={() => toggleNotification('push')}
                >
                  {notifications.push ? 'Включено' : 'Выключено'}
                </Button>
              </Group>

              <Group justify="space-between">
                <div>
                  <Text size="sm" fw={500}>Безопасность</Text>
                  <Text size="xs" c="dimmed">Уведомления о входе в аккаунт</Text>
                </div>
                <Button 
                  size="xs" 
                  variant={notifications.security ? "light" : "outline"}
                  color={notifications.security ? "blue" : "gray"}
                  onClick={() => toggleNotification('security')}
                >
                  {notifications.security ? 'Включено' : 'Выключено'}
                </Button>
              </Group>
            </SimpleGrid>
          </Card>
        </Grid.Col>
      </Grid>

      <Modal
        opened={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Редактирование профиля"
        size="md"
      >
        <Stack gap="md">
          {editError && (
            <Alert icon={<IconAlertCircle size={16} />} title="Ошибка" color="red">
              {editError}
            </Alert>
          )}
          
          <TextInput
            label="Имя"
            value={editFormData.firstName}
            onChange={(e) => setEditFormData(prev => ({ ...prev, firstName: e.target.value }))}
            placeholder="Введите ваше имя"
          />

          <TextInput
            label="Фамилия"
            value={editFormData.lastName}
            onChange={(e) => setEditFormData(prev => ({ ...prev, lastName: e.target.value }))}
            placeholder="Введите вашу фамилию"
          />

          <TextInput
            label="Телефон"
            value={editFormData.phone}
            onChange={(e) => setEditFormData(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="+7 (999) 123-45-67"
          />

          <TextInput
            label="Дата рождения"
            type="date"
            value={editFormData.birthDate}
            onChange={(e) => setEditFormData(prev => ({ ...prev, birthDate: e.target.value }))}
          />

          <Select
            label="Пол"
            placeholder="Выберите пол"
            value={editFormData.gender}
            onChange={(value) => setEditFormData(prev => ({ ...prev, gender: value as 'MALE' | 'FEMALE' | 'OTHER' | '' }))}
            data={[
              { value: 'MALE', label: 'Мужской' },
              { value: 'FEMALE', label: 'Женский' },
              { value: 'OTHER', label: 'Другой' },
            ]}
          />

          <Group justify="flex-end" gap="sm" mt="md">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSaveProfile} loading={isLoading}>
              Сохранить
            </Button>
          </Group>
        </Stack>
      </Modal>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleAvatarUpload}
      />
    </Container>
  );
}

