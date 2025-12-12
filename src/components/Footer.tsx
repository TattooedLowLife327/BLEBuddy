import React from 'react';
import { Lock } from 'lucide-react';

const socialLinks = [
  {
    name: 'twitch',
    href: 'https://twitch.tv/thetattooedlowlife',
    label: 'Twitch',
    icon: '/icons/twitch.svg',
  },
  {
    name: 'facebook',
    href: 'https://www.facebook.com/groups/thelowlifesofgranboard',
    label: 'Facebook',
    icon: '/icons/facebook.svg',
  },
  {
    name: 'messenger',
    href: 'https://m.me/thetattooedlowlife',
    label: 'Messenger',
    icon: '/icons/messenger.svg',
  },
  {
    name: 'spotify',
    href: 'https://open.spotify.com/playlist/5STE00xXwZoXYHllJFUZ1A?si=228d4850550c4516',
    label: 'Spotify',
    icon: '/icons/spotify.svg',
  },
  {
    name: 'tiktok',
    href: 'https://www.tiktok.com/@thetattooedlowlife',
    label: 'TikTok',
    icon: '/icons/tiktok.svg',
  },
  {
    name: 'snapchat',
    href: 'https://snapchat.com/add/thelowlifesofgb',
    label: 'Snapchat',
    icon: '/icons/snapchat.svg',
  },
  {
    name: 'discord',
    href: 'https://discord.gg/34EvjDGQgb',
    label: 'Discord',
    icon: '/icons/discord.svg',
  },
  {
    name: 'instagram',
    href: 'https://instagram.com/thetattooedlowlife',
    label: 'Instagram',
    icon: '/icons/instagram.svg',
  },
  {
    name: 'youtube',
    href: 'https://youtube.com/@thetattooedlowlife',
    label: 'YouTube',
    icon: '/icons/youtube.svg',
  },
  {
    name: 'twitter',
    href: 'https://x.com/Tat2dLowLife',
    label: 'Twitter',
    icon: '/icons/twitter.svg',
  },
];

export function Footer({ onLockClick }: { onLockClick?: () => void }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full mt-auto pb-2">
      <div className="mx-auto">
        {/* Social Icons */}
        <div className="flex items-center justify-center gap-4 mb-2">
          {socialLinks.map(social => (
            <a
              key={social.name}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className="transform hover:scale-110 transition-all duration-200"
              aria-label={social.label}
            >
              <img
                src={social.icon}
                alt={social.label}
                className="h-[22px] w-auto"
              />
            </a>
          ))}
        </div>

        {/* Links with dividers */}
        <div className="flex items-center justify-center gap-3 text-sm mb-2">
          <a
            href="https://www.lowlifesofgranboard.com/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-300 hover:text-white transition-colors duration-200"
          >
            Terms
          </a>
          <span className="text-gray-600">|</span>
          <a
            href="https://www.lowlifesofgranboard.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-300 hover:text-white transition-colors duration-200"
          >
            Privacy
          </a>
          <span className="text-gray-600">|</span>
          <a
            href="https://www.lowlifesofgranboard.com/contact"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-300 hover:text-white transition-colors duration-200"
          >
            Contact
          </a>
        </div>

        {/* Copyright */}
        <div className="text-center text-gray-400 relative text-xs">
          © 2022-{currentYear} The LowLifes of Granboard™
          {onLockClick && (
            <button
              aria-label="Unlock"
              onClick={onLockClick}
              className="absolute right-4 top-0 opacity-10 hover:opacity-30 transition-opacity"
            >
              <Lock size={14} />
            </button>
          )}
        </div>
      </div>
    </footer>
  );
}

export default Footer;
