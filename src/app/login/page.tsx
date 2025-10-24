"use client"
import { Button, Center, Container, PasswordInput, Stack, TextInput } from "@mantine/core";
import { useLoginMutation } from '@/lib/store/api/AuthApi';
import { useState } from 'react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [login, { isLoading }] = useLoginMutation();

  const handleSubmit = async () => {
    try {
      const result = await login({ email, password }).unwrap();

      localStorage.setItem('access_token', result.access_token);
      localStorage.setItem('user', JSON.stringify(result.user));

      window.location.href = '/dashboard';

    } catch (error) {
      console.error('Ошибка входа:', error);
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
            Войти
          </Button>
        </Stack>
      </Container>
    </Center>
  )
}