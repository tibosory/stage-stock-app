import React from 'react';
import { Ionicons } from '@expo/vector-icons';

interface IconProps {
  size?: number;
  color?: string;
}

const icon =
  (name: React.ComponentProps<typeof Ionicons>['name']) =>
  ({ size = 22, color = '#fff' }: IconProps) =>
    <Ionicons name={name} size={size} color={color} />;

export const ScanIcon = icon('scan-outline');
export const BoxIcon = icon('cube-outline');
export const ClipboardIcon = icon('clipboard-outline');
export const CartIcon = icon('cart-outline');
export const BellIcon = icon('notifications-outline');
export const GearIcon = icon('settings-outline');
export const CameraIcon = icon('camera-outline');
export const NfcIcon = icon('wifi-outline');
export const SearchIcon = icon('search-outline');
export const PlusIcon = icon('add');
export const TrashIcon = icon('trash-outline');
export const EditIcon = icon('pencil-outline');
export const EyeIcon = icon('eye-outline');
export const WarnIcon = icon('warning-outline');
export const QrIcon = icon('qr-code-outline');
export const LightningIcon = icon('flash-outline');
export const KeyboardIcon = icon('keypad-outline');
export const CheckIcon = icon('checkmark');
/** Visites générales périodiques / contrôles réglementaires */
export const VgpIcon = icon('calendar-outline');
export const NetworkIcon = icon('wifi-outline');
export const UserIcon = icon('person-outline');
export const InboxIcon = icon('mail-open-outline');
export const BookIcon = icon('book-outline');
export const SparklesIcon = icon('sparkles-outline');
/** Hub « Menu » (liste des rubriques) */
export const MenuIcon = icon('menu-outline');
