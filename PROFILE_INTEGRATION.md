# Интеграция профиля с бэкендом

## Обзор

Профиль пользователя теперь полностью интегрирован с бэкендом через следующие компоненты:

### 1. API слой

#### AuthApi (`src/lib/store/api/AuthApi.ts`)
- `POST /auth/register` - Регистрация пользователя
- `POST /auth/login` - Вход в систему  
- `GET /auth/profile` - Получение профиля из JWT токена
- `POST /auth/logout` - Выход из системы

#### UserApi (`src/lib/store/api/UserApi.ts`)
- `GET /user/me` - Получение полной информации о пользователе
- `PUT /user/me` - Обновление основной информации пользователя
- `GET /user/profile` - Получение профиля пользователя
- `PUT /user/profile` - Обновление профиля
- `DELETE /user/profile` - Мягкое удаление профиля
- `POST /user/profile/restore` - Восстановление профиля
- `POST /user/profile/avatar` - Загрузка аватара
- `GET /user/profile/avatar/:fileId` - Получение аватара
- `DELETE /user/profile/avatar/:fileId` - Удаление аватара
- `POST /user/profile/avatar/:fileId/refresh-url` - Обновление URL аватара

### 2. Хуки

#### useProfile (`src/lib/hooks/useProfile.ts`)
Предоставляет удобный интерфейс для работы с профилем:

```typescript
const {
  user,           // Данные пользователя
  profile,        // Данные профиля
  isLoading,      // Состояние загрузки
  error,          // Ошибки
  handleUpdateUser,      // Обновление пользователя
  handleUpdateProfile,   // Обновление профиля
  handleUploadAvatar,    // Загрузка аватара
  handleDeleteAvatar,    // Удаление аватара
  getFullName,           // Полное имя
  getInitials,           // Инициалы для аватара
  hasAvatar,            // Проверка наличия аватара
  formatDate,           // Форматирование даты
  formatBirthDate,      // Форматирование даты рождения
} = useProfile();
```

### 3. Обновленная страница профиля

Страница профиля (`src/app/profile/page.tsx`) теперь:
- Загружает реальные данные с бэкенда
- Показывает состояния загрузки и ошибки
- Позволяет редактировать профиль
- Поддерживает загрузку аватара
- Обрабатывает выход из системы

## Использование

### Импорт хуков
```typescript
import { useProfile } from '@/lib/hooks/useProfile';
import { useLogoutMutation } from '@/lib/store/api/AuthApi';
```

### Импорт API
```typescript
import { 
  useGetCurrentUserQuery,
  useUpdateProfileMutation,
  useUploadAvatarMutation 
} from '@/lib/store/api/UserApi';
```

## Функциональность

### ✅ Реализовано
- [x] Получение данных пользователя и профиля
- [x] Редактирование профиля
- [x] Загрузка аватара
- [x] Обработка ошибок
- [x] Состояния загрузки
- [x] Выход из системы
- [x] Автоматическое обновление данных

### 🔄 Автоматические обновления
- Данные профиля автоматически обновляются после изменений
- Кэширование через RTK Query
- Инвалидация кэша при изменениях

### 🛡️ Безопасность
- JWT токены передаются через HTTP-only cookies
- Автоматическое добавление Authorization заголовков
- Проверка аутентификации на всех эндпоинтах

## Структура данных

### User
```typescript
interface User {
  id: number;
  username: string;
  email: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  profile?: Profile;
}
```

### Profile
```typescript
interface Profile {
  id: number;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  birthDate?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

## Обработка ошибок

Все API вызовы обрабатывают ошибки и показывают пользователю понятные сообщения. Ошибки автоматически логируются в консоль для отладки.
