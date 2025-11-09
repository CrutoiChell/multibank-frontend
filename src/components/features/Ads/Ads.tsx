'use client';

import { useState } from 'react';
import { Card, Image, Text, Button, Badge, Group, Stack, Box } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import type { Ad } from '@/lib/store/api/AdsApi';
import classes from './Ads.module.css';

interface AdsProps {
  ad: Ad;
  onClose?: () => void;
  onLinkClick?: () => void;
}

export function Ads({ ad, onClose, onLinkClick }: AdsProps) {
  const [imageError, setImageError] = useState(false);
  const fallbackImage = 'https://via.placeholder.com/400x200?text=Ad+Image';

  const handleLinkClick = () => {
    if (onLinkClick) {
      onLinkClick();
    }
    window.open(ad.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={classes.container}
    >
      <Card
        shadow="lg"
        padding="lg"
        radius="md"
        withBorder
        className={classes.card}
      >
        <Stack gap="md">
          {/* Image Section */}
          <Box className={classes.imageContainer}>
            <Image
              src={imageError ? fallbackImage : ad.image}
              alt={ad.ads}
              className={classes.image}
              onError={() => setImageError(true)}
            />
          </Box>

          {/* Content Section */}
          <Stack gap="xs">
            <Group justify="space-between" align="flex-start">
              <Badge color="gray" variant="light" size="sm">
                {ad.partner}
              </Badge>
            </Group>

            <Text fw={600} size="lg" className={classes.title}>
              {ad.ads}
            </Text>
          </Stack>

          {/* Actions */}
          <Group justify="flex-end" gap="sm">
            <Button
              rightSection={<IconExternalLink size={16} />}
              onClick={handleLinkClick}
              className={classes.actionButton}
              fullWidth
              size="sm"
            >
              Перейти
            </Button>
          </Group>
        </Stack>
      </Card>
    </motion.div>
  );
}

