"use client"
import { IconChevronDown } from '@tabler/icons-react';
import { Burger, Center, Container, Group, Menu, Drawer, Stack, Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import Logo from '../../../../public/Logo.png'
import classes from './Header.module.css';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';
import { useGetCurrentUserQuery } from '@/lib/store/api/UserApi';
import { useLogoutMutation } from '@/lib/store/api/AuthApi';

const links = [
    { link: '/', label: 'Главная' },
    { link: '/dashboard', label: 'Дашборд' },
    { link: '/analytics', label: 'Аналитика' },
    { link: '/login', label: 'Войти' },
    { link: '/registration', label: 'Регистрация' },
    { link: '/profile', label: 'Профиль' },
];

export function Header() {
    const { data: me, isSuccess, isLoading, isError } = useGetCurrentUserQuery();
    const [logout] = useLogoutMutation();
    const [opened, { toggle, close }] = useDisclosure(false);

    const isAuth = useMemo(() => !!me || !!isSuccess, [me, isSuccess]);

    const handleLogout = async () => {
        try {
            await logout().unwrap();
        } catch {}
        close();
        window.location.href = '/';
    };

    const visibleLinks = links.filter(link => {
        if (isAuth) {
            // Для авторизованных: показываем все, кроме "Войти" и "Регистрация"
            return link.label !== 'Войти' && link.label !== 'Регистрация';
        } else {
            // Для неавторизованных: показываем только публичные страницы
            return link.label !== 'Профиль' && 
                   link.label !== 'Дашборд' && 
                   link.label !== 'Аналитика';
        }
    });

    const items = (isLoading && !isAuth) ? visibleLinks
      .filter(l => l.label !== 'Профиль')
      .map((link) => (
        <Link key={link.label} href={link.link} className={classes.link}>
            {link.label}
        </Link>
      ))
      : visibleLinks.map((link) => {
        if (link.label === 'Профиль') {
            return (
                <Menu key={link.label} trigger="hover" transitionProps={{ exitDuration: 0 }} withinPortal>
                    <Menu.Target>
                        <a
                            href="#"
                            className={classes.link}
                            onClick={(event) => event.preventDefault()}
                        >
                            <Center>
                                <span className={classes.linkLabel}>{me?.username || 'Профиль'}</span>
                                <IconChevronDown size={14} stroke={1.5} />
                            </Center>
                        </a>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Item onClick={() => window.location.href = '/profile'}>Профиль</Menu.Item>
                        <Menu.Item onClick={handleLogout}>Выйти</Menu.Item>
                    </Menu.Dropdown>
                </Menu>
            );
        }

        return (
            <Link
                key={link.label}
                href={link.link}
                className={classes.link}
            >
                {link.label}
            </Link>
        );
    });

    const mobileItems = visibleLinks.map((link) => {
        if (link.label === 'Профиль') {
            return (
                <Stack key={link.label} gap="xs">
                    <Button
                        variant="subtle"
                        fullWidth
                        justify="flex-start"
                        component={Link}
                        href="/profile"
                        onClick={close}
                    >
                        Профиль
                    </Button>
                    <Button
                        variant="subtle"
                        color="red"
                        fullWidth
                        justify="flex-start"
                        onClick={handleLogout}
                    >
                        Выйти
                    </Button>
                </Stack>
            );
        }

        return (
            <Button
                key={link.label}
                variant="subtle"
                fullWidth
                justify="flex-start"
                component={Link}
                href={link.link}
                onClick={close}
            >
                {link.label}
            </Button>
        );
    });

    return (
        <header className={classes.header}>
            <Container size="md">
                <div className={classes.inner}>
                    <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
                        <Image
                            src={Logo}
                            width={100}
                            height={30}
                            alt="Logo"
                            style={{ cursor: 'pointer' }}
                        />
                    </Link>
                    <Group gap={5} visibleFrom="sm">
                        {items}
                    </Group>
                    <Burger opened={opened} onClick={toggle} size="sm" hiddenFrom="sm" />
                </div>
            </Container>

            <Drawer
                opened={opened}
                onClose={close}
                title="Меню"
                position="right"
                hiddenFrom="sm"
                padding="md"
            >
                <Stack gap="xs">
                    {mobileItems}
                </Stack>
            </Drawer>
        </header>
    );
}