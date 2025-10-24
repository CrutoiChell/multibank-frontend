"use client"
import { IconChevronDown } from '@tabler/icons-react';
import { Burger, Center, Container, Group, Menu } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import Logo from '../../../../public/Logo.png'
import classes from './Header.module.css';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const links = [
    { link: '/', label: 'Главная' },
    { link: '/dashboard', label: 'Дашборд' },
    { link: '/analytics', label: 'Аналитика' },
    { link: '/login', label: 'Войти' },
    { link: '/registration', label: 'Регистрация' },
    { link: '/profile', label: 'Профиль' },
];

export function Header() {
    const [isAuth, setIsAuth] = useState(false);
    const [opened, { toggle }] = useDisclosure(false);

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        setIsAuth(!!token);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        setIsAuth(false);
        window.location.href = '/';
    };

    const visibleLinks = links.filter(link => {
        if (isAuth) {
            return link.label !== 'Войти' && link.label !== 'Регистрация';
        } else {
            return link.label !== 'Профиль';
        }
    });

    const items = visibleLinks.map((link) => {
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
                                <span className={classes.linkLabel}>{link.label}</span>
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

    return (
        <header className={classes.header}>
            <Container size="md">
                <div className={classes.inner}>
                    <Image
                        src={Logo}
                        width={100}
                        height={30}
                        alt="Logo"
                    />
                    <Group gap={5} visibleFrom="sm">
                        {items}
                    </Group>
                    <Burger opened={opened} onClick={toggle} size="sm" hiddenFrom="sm" />
                </div>
            </Container>
        </header>
    );
}