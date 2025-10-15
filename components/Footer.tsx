import React from 'react';
import { Lock } from 'lucide-react';

// Using inline SVG icons for better mobile compatibility
const socialIcons = {
  twitch: (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
    </svg>
  ),
  facebook: (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
  youtube: (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
  snapchat: (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301a.87.87 0 0 1 .434-.06c.36.03.664.195.734.479.041.149-.03.33-.193.42-.244.149-.629.284-1.034.404-.584.179-.63.239-.72.39-.105.18-.09.39.06.555.48.51 1.349 1.289 2.399 1.574.21.045.42.12.57.255.12.12.21.27.21.435 0 .449-.524.689-1.049.839-.255.075-.51.105-.765.15-.314.06-.614.135-.899.225-.27.105-.54.24-.765.42-.165.135-.345.345-.345.645 0 .06 0 .135.015.21.03.165.074.314.074.464 0 .18-.12.345-.3.39-.21.06-.419.03-.599-.015-.36-.09-.704-.209-1.019-.329-.36-.134-.72-.269-1.095-.329a1.57 1.57 0 0 0-.42-.06c-.314 0-.629.12-.944.27-.63.3-1.364.675-2.429.675-.735 0-1.41-.165-2.009-.375a5.15 5.15 0 0 0-1.394-.255c-.21 0-.375.015-.54.045-.315.06-.735.195-1.095.33-.315.12-.659.24-1.019.33-.18.045-.389.074-.599.014-.18-.044-.3-.209-.3-.389 0-.15.045-.3.074-.465.015-.074.015-.149.015-.209 0-.3-.18-.51-.345-.645-.225-.18-.495-.315-.765-.42-.285-.09-.585-.165-.9-.225-.254-.045-.509-.075-.764-.15-.525-.15-1.05-.39-1.05-.839 0-.165.09-.315.21-.435.15-.135.36-.21.57-.255 1.05-.285 1.92-1.065 2.399-1.574.15-.165.165-.375.06-.555-.09-.15-.135-.21-.72-.39-.404-.12-.789-.255-1.033-.404-.165-.09-.234-.27-.194-.42.07-.284.374-.449.734-.479.15-.015.3 0 .435.06.374.18.734.285 1.034.3.195 0 .33-.045.404-.09-.008-.165-.018-.33-.03-.51l-.002-.06c-.105-1.628-.23-3.654.3-4.847C6.654 1.068 10.002.793 11.011.793h1.195z" />
    </svg>
  ),
  discord: (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.046-.32 13.41.099 17.721a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026 13.83 13.83 0 0 0 1.226-1.963.074.074 0 0 0-.041-.104 13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125 10.2 10.2 0 0 0 .372-.291.072.072 0 0 1 .076-.01c3.928 1.764 8.18 1.764 12.061 0a.071.071 0 0 1 .078.009c.12.098.246.195.373.292a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.027 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 14.847c-1.182 0-2.157-1.06-2.157-2.364 0-1.303.956-2.364 2.157-2.364 1.21 0 2.176 1.07 2.157 2.364 0 1.304-.956 2.364-2.157 2.364zm7.975 0c-1.183 0-2.157-1.06-2.157-2.364 0-1.303.955-2.364 2.157-2.364 1.21 0 2.176 1.07 2.157 2.364 0 1.304-.946 2.364-2.157 2.364z" />
    </svg>
  ),
  spotify: (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  ),
  tiktok: (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  ),
};

const socialLinks = [
  {
    name: 'twitch',
    href: 'https://twitch.tv/thetattooedlowlife',
    label: 'Twitch',
  },
  {
    name: 'facebook',
    href: 'https://www.facebook.com/groups/thelowlifesofgranboard',
    label: 'Facebook',
  },
  {
    name: 'youtube',
    href: 'https://youtube.com/@thetattooedlowlife',
    label: 'YouTube',
  },
  {
    name: 'snapchat',
    href: 'https://snapchat.com/add/thelowlifesofgb',
    label: 'Snapchat',
  },
  {
    name: 'discord',
    href: 'https://discord.gg/34EvjDGQgb',
    label: 'Discord',
  },
  {
    name: 'spotify',
    href: 'https://open.spotify.com/playlist/5STE00xXwZoXYHllJFUZ1A?si=228d4850550c4516',
    label: 'Spotify',
  },
  {
    name: 'tiktok',
    href: 'https://www.tiktok.com/@thetattooedlowlife',
    label: 'TikTok',
  },
];

export function Footer({ onLockClick }: { onLockClick?: () => void }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full mt-auto pb-2">
      <div className="mx-auto">
        {/* Social Icons */}
        <div className="flex items-center justify-center gap-3 mb-2">
          {socialLinks.map(social => (
            <a
              key={social.name}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-300 hover:text-white transform hover:scale-110 transition-all duration-200"
              aria-label={social.label}
            >
              <div style={{ width: '18px', height: '18px' }}>{socialIcons[social.name as keyof typeof socialIcons]}</div>
            </a>
          ))}
        </div>

        {/* Links with dividers */}
        <div className="flex items-center justify-center gap-3 text-xs mb-2">
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
