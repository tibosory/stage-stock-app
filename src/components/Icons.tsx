// src/components/Icons.tsx
import React from 'react';
import { Text } from 'react-native';

interface IconProps { size?: number; color?: string; }

export const ScanIcon = ({ size = 24, color = '#fff' }: IconProps) => (
  <Text style={{ fontSize: size * 0.85, color }}>⊞</Text>
);
export const BoxIcon = ({ size = 24, color = '#fff' }: IconProps) => (
  <Text style={{ fontSize: size * 0.85, color }}>📦</Text>
);
export const ClipboardIcon = ({ size = 24, color = '#fff' }: IconProps) => (
  <Text style={{ fontSize: size * 0.85, color }}>📋</Text>
);
export const CartIcon = ({ size = 24, color = '#fff' }: IconProps) => (
  <Text style={{ fontSize: size * 0.85, color }}>🛒</Text>
);
export const BellIcon = ({ size = 24, color = '#fff' }: IconProps) => (
  <Text style={{ fontSize: size * 0.85, color }}>🔔</Text>
);
export const GearIcon = ({ size = 24, color = '#fff' }: IconProps) => (
  <Text style={{ fontSize: size * 0.85, color }}>⚙️</Text>
);
export const CameraIcon = ({ size = 24, color = '#fff' }: IconProps) => (
  <Text style={{ fontSize: size * 0.85, color }}>📷</Text>
);
export const NfcIcon = ({ size = 24, color = '#fff' }: IconProps) => (
  <Text style={{ fontSize: size * 0.85, color }}>📡</Text>
);
export const SearchIcon = ({ size = 24, color = '#fff' }: IconProps) => (
  <Text style={{ fontSize: size * 0.85, color }}>🔍</Text>
);
export const PlusIcon = ({ size = 24, color = '#fff' }: IconProps) => (
  <Text style={{ fontSize: size * 0.85, color, fontWeight: 'bold' }}>+</Text>
);
export const TrashIcon = ({ size = 24, color = '#fff' }: IconProps) => (
  <Text style={{ fontSize: size * 0.85, color }}>🗑️</Text>
);
export const EditIcon = ({ size = 24, color = '#fff' }: IconProps) => (
  <Text style={{ fontSize: size * 0.85, color }}>✏️</Text>
);
export const EyeIcon = ({ size = 24, color = '#fff' }: IconProps) => (
  <Text style={{ fontSize: size * 0.85, color }}>👁</Text>
);
export const WarnIcon = ({ size = 24, color = '#fff' }: IconProps) => (
  <Text style={{ fontSize: size * 0.85, color }}>⚠️</Text>
);
export const QrIcon = ({ size = 24, color = '#fff' }: IconProps) => (
  <Text style={{ fontSize: size * 0.85, color }}>⊞</Text>
);
export const LightningIcon = ({ size = 24, color = '#fff' }: IconProps) => (
  <Text style={{ fontSize: size * 0.85, color }}>⚡</Text>
);
export const KeyboardIcon = ({ size = 24, color = '#fff' }: IconProps) => (
  <Text style={{ fontSize: size * 0.85, color }}>⌨️</Text>
);
export const CheckIcon = ({ size = 24, color = '#fff' }: IconProps) => (
  <Text style={{ fontSize: size * 0.85, color }}>✓</Text>
);
