"use client"
import { Button, Center, Container, PasswordInput, Stack, TextInput } from "@mantine/core";

import { useRegisterMutation } from '@/lib/store/api/AuthApi';
import { userApi } from '@/lib/store/api/UserApi';
import { authApi } from '@/lib/store/api/AuthApi';
import { useDispatch } from 'react-redux';
import { useState } from 'react';

export default function Registration() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [register, { isLoading }] = useRegisterMutation();
  const dispatch = useDispatch();

  const handleSubmit = async () => {
    try {
      dispatch(userApi.util.resetApiState());
      dispatch(authApi.util.resetApiState());
      
      const result = await register({ email, password }).unwrap();
      localStorage.setItem('access_token', result.access_token);
      localStorage.setItem('user', JSON.stringify(result.user));

      document.cookie = `access_token=${result.access_token}; path=/`;

      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Ошибка регистрации:', error);
    }
  };



  return (
    <Center h={200}>
      <Container size="sm">
        <Stack w={400}>
          <TextInput
            label="Почта"
            placeholder="Иванов@mail.ru"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <PasswordInput
            label="Пароль"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button
            onClick={handleSubmit}
            loading={isLoading}
          >
            Зарегистрироваться
          </Button>
        </Stack>
      </Container>
    </Center>
  )
}