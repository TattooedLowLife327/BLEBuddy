import React, { useState, useRef, useLayoutEffect, useEffect, useMemo } from 'react';
import { createClient } from '../utils/supabase/client';
import bannerImage from '../metatagbanner.png';
import backgroundImage from '../background.png';
import { Footer } from './Footer';
import AnimatedCheckbox from './AnimatedCheckbox';
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai';

// Helper function to calculate email input progress
function getEmailProgress(email: string) {
  if (!email) return 0;
  if (!email.includes('@')) return Math.min(email.length / 10, 0.5);
  const [, domain] = email.split('@');
  if (domain && /\.[a-zA-Z]{2,}$/.test(domain)) return 1;
  return 0.5 + Math.min(domain.length / 10, 0.5);
}

// Helper function to calculate password input progress (min 8 characters)
function getPasswordProgress(password: string) {
  const minLength = 8;
  if (!password) return 0;
  return Math.min(password.length / minLength, 1);
}

interface LoginProps {
  onLoginSuccess: () => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);

  // --- Start: Hooks for animated inputs ---
  const [emailError, setEmailError] = useState(false);
  const [shakeTrigger, setShakeTrigger] = useState(false);

  // Refs to get input dimensions
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // State to store input dimensions
  const [emailRect, setEmailRect] = useState({ width: 0, height: 0 });
  const [passwordRect, setPasswordRect] = useState({ width: 0, height: 0 });

  // Effect to measure inputs on render/resize
  useLayoutEffect(() => {
    if (emailInputRef.current) {
      setEmailRect(emailInputRef.current.getBoundingClientRect());
    }
    if (passwordInputRef.current) {
      setPasswordRect(passwordInputRef.current.getBoundingClientRect());
    }
  }, []); // Run on mount

  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (isMounted && session?.user) {
          onLoginSuccess();
        }
      })
      .catch(error => {
        console.error('Failed to check existing session:', error);
      });

    return () => {
      isMounted = false;
    };
  }, [supabase, onLoginSuccess]);

  const radius = 16; // Border radius of the inputs

  // Calculations for email border animation
  const { width: emailWidth, height: emailHeight } = emailRect;
  const emailBorderLength =
    emailWidth && emailHeight
      ? 2 * (emailWidth - radius * 2) + 2 * (emailHeight - radius * 2) + 2 * Math.PI * radius
      : 0;
  const emailProgress = getEmailProgress(email);
  const emailDashOffset = emailBorderLength * (1 - emailProgress);

  // Calculations for password border animation
  const { width: passWidth, height: passHeight } = passwordRect;
  const passBorderLength =
    passWidth && passHeight
      ? 2 * (passWidth - radius * 2) + 2 * (passHeight - radius * 2) + 2 * Math.PI * radius
      : 0;
  const passwordProgress = getPasswordProgress(password);
  const passwordDashOffset = passBorderLength * (1 - passwordProgress);

  const handleEmailBlur = () => {
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isValid && email.length > 0) {
      setEmailError(true);
      setShakeTrigger(true);
      setTimeout(() => {
        setEmailError(false);
        setShakeTrigger(false);
      }, 900);
    }
  };
  // --- End: Hooks for animated inputs ---

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    // Final check for password length before submitting
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error || !data?.user) {
        setFailedAttempts(prev => prev + 1);
        if (error?.message?.toLowerCase().includes('invalid login')) {
          setErrorMsg(
            failedAttempts >= 1
              ? 'Still incorrect. Please check your credentials or request a password reset link.'
              : 'Invalid login credentials'
          );
        } else if (
          error?.message?.includes('Failed to fetch') ||
          error?.message?.includes('network')
        ) {
          setErrorMsg(
            'Unable to connect to the server. Please check your internet connection and try again.'
          );
        } else {
          setErrorMsg(error?.message || 'An error occurred during login. Please try again.');
        }
        setIsLoading(false);
        return;
      }
      // Session and user are available
      const user = data.user;
      console.log('Login successful:', user);
      onLoginSuccess();
    } catch (err: any) {
      setErrorMsg('Unable to connect to the server. Please try again.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{`
        /* Animation styles for email input error */
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }
        .shake {
          animation: shake 0.4s ease-in-out;
        }
        .red-glow {
          stroke: #ff3b3b !important;
          filter: drop-shadow(0 0 5px #ff3b3b);
          transition: stroke 0.6s ease, filter 0.6s ease;
        }
        .red-label {
          color: #ff3b3b !important;
          transition: color 0.6s ease;
        }
      `}</style>

      <div
        className="min-h-screen flex flex-col items-center justify-center bg-black text-white px-6 overflow-hidden"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="w-full max-w-md mx-auto px-4">
          <div
            className="rounded-xl shadow-2xl border-[4px] bg-black/95 backdrop-blur-lg mb-4 overflow-hidden"
            style={{
              borderColor: '#a855f7',
              boxShadow: `
                0 0 24px 4px rgba(168,85,247,0.5),
                0 0 48px 12px rgba(168,85,247,0.25),
                0 8px 32px 0 rgba(0,0,0,0.37)
              `,
              borderRadius: '0.75rem',
              marginTop: '2rem',
              marginBottom: '2rem',
            }}
          >
            {/* Banner */}
            <div className="w-full p-4">
              <img
                src={bannerImage}
                alt="LowLife Banner"
                className="w-full h-auto rounded-t-2xl"
              />
            </div>

            {/* Form */}
            <div className="p-6 w-full">
              <h2 className="text-xl font-semibold text-center mb-6">LowLife Login</h2>
              <form action="#" onSubmit={handleLogin} className="space-y-6" autoComplete="on">
                {/* --- Animated Email Input --- */}
                <div className="relative w-full max-w-full">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-20">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="lucide lucide-mail h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                    </svg>
                  </span>
                  {emailWidth > 0 && emailHeight > 0 && (
                    <svg
                      className="absolute left-0 top-0 pointer-events-none"
                      style={{ zIndex: 2 }}
                      width={emailWidth}
                      height={emailHeight}
                    >
                      <rect
                        x="1"
                        y="1"
                        width={emailWidth - 2}
                        height={emailHeight - 2}
                        rx={radius}
                        fill="none"
                        stroke="#9ca3af"
                        strokeWidth="2"
                      />
                      {email.length > 0 && (
                        <rect
                          x="1"
                          y="1"
                          width={emailWidth - 2}
                          height={emailHeight - 2}
                          rx={radius}
                          fill="none"
                          className={emailError ? 'red-glow' : ''}
                          stroke="#a259f7"
                          strokeWidth="2"
                          strokeDasharray={emailBorderLength}
                          strokeDashoffset={emailDashOffset}
                          style={{
                            transition:
                              'stroke 0.3s ease, stroke-dashoffset 0.7s ease, filter 0.3s ease',
                          }}
                        />
                      )}
                    </svg>
                  )}
                  <label
                    htmlFor="login-email"
                    className={`absolute px-1 bg-black z-30 transition-all duration-200 pointer-events-none ${emailError ? 'red-label' : ''}`}
                    style={{
                      left: email ? '.6rem' : '2.2rem',
                      top: email ? '-0.4rem' : '50%',
                      transform: email ? 'none' : 'translateY(-50%)',
                      fontSize: email ? '0.75rem' : '1rem',
                      lineHeight: '1',
                      color: email ? '#fff' : '#9ca3af',
                    }}
                  >
                    Email Address
                  </label>
                  <input
                    ref={emailInputRef}
                    id="login-email"
                    type="email"
                    name="email"
                    value={email}
                    onBlur={handleEmailBlur}
                    onChange={e => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError(false);
                    }}
                    autoComplete="email"
                    required
                    placeholder=" "
                    className={`peer block w-full h-12 px-3 pl-10 bg-transparent rounded-2xl appearance-none focus:outline-none text-white border-none ${shakeTrigger ? 'shake' : ''}`}
                    style={{
                      backgroundColor: 'transparent',
                      color: '#fff',
                      position: 'relative',
                      zIndex: 10,
                    }}
                  />
                </div>

                {/* --- Animated Password Input --- */}
                <div className="relative w-full max-w-full">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-20">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="lucide lucide-lock h-5 w-5"
                    >
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </span>
                  {passWidth > 0 && passHeight > 0 && (
                    <svg
                      className="absolute left-0 top-0 pointer-events-none"
                      style={{ zIndex: 2 }}
                      width={passWidth}
                      height={passHeight}
                    >
                      <rect
                        x="1"
                        y="1"
                        width={passWidth - 2}
                        height={passHeight - 2}
                        rx={radius}
                        fill="none"
                        stroke="#9ca3af"
                        strokeWidth="2"
                      />
                      {password.length > 0 && (
                        <rect
                          x="1"
                          y="1"
                          width={passWidth - 2}
                          height={passHeight - 2}
                          rx={radius}
                          fill="none"
                          stroke="#a259f7"
                          strokeWidth="2"
                          strokeDasharray={passBorderLength}
                          strokeDashoffset={passwordDashOffset}
                          style={{ transition: 'stroke-dashoffset 0.7s ease' }}
                        />
                      )}
                    </svg>
                  )}
                  <label
                    htmlFor="login-password"
                    className="absolute px-1 bg-black z-30 transition-all duration-200 pointer-events-none"
                    style={{
                      left: password ? '.6rem' : '2.2rem',
                      top: password ? '-0.4rem' : '50%',
                      transform: password ? 'none' : 'translateY(-50%)',
                      fontSize: password ? '0.75rem' : '1rem',
                      lineHeight: '1',
                      color: password ? '#fff' : '#9ca3af',
                    }}
                  >
                    Password
                  </label>
                  <input
                    ref={passwordInputRef}
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    placeholder=" "
                    className="peer block w-full h-12 px-3 pl-10 bg-transparent rounded-2xl appearance-none focus:outline-none text-white border-none"
                    style={{
                      backgroundColor: 'transparent',
                      color: '#fff',
                      position: 'relative',
                      zIndex: 10,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-20 text-white"
                  >
                    {showPassword ? (
                      <AiOutlineEyeInvisible size={20} />
                    ) : (
                      <AiOutlineEye size={20} />
                    )}
                  </button>
                </div>

                <div className="flex justify-between items-center mt-2 px-2">
                  <AnimatedCheckbox
                    checked={rememberMe}
                    onChange={setRememberMe}
                    label="Remember me"
                    className="text-sm"
                  />
                  <a
                    href="https://www.lowlifesofgranboard.com/forgot-password"
                    className="text-purple-400 hover:text-purple-300 underline text-sm"
                  >
                    Forgot Password?
                  </a>
                </div>

                {errorMsg && (
                  <div className="bg-red-900/50 border border-red-500 rounded-lg p-3 text-center mx-2">
                    <p className="text-red-200 text-sm">{errorMsg}</p>
                  </div>
                )}

                <div className="px-2 pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full bg-purple-800 hover:bg-purple-900 p-4 rounded-xl font-medium transition-all duration-300 transform hover:scale-[1.02] ${
                      isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    {isLoading ? 'Loading...' : 'Login'}
                  </button>
                </div>
              </form>
              <p className="text-center text-sm pt-4 text-gray-400">
                Not a LowLife yet?{' '}
                <a
                  href="https://www.lowlifesofgranboard.com/register"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 underline"
                >
                  Sign up!
                </a>
              </p>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}
