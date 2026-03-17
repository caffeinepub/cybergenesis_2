import { AlertTriangle, RefreshCw } from "lucide-react";
import React, { useEffect, useState } from "react";
import ConfigValidator from "./components/ConfigValidator";
import CosmicBackground from "./components/CosmicBackground";
import ParticleBackground from "./components/ParticleBackground";
import ProfileSetup from "./components/ProfileSetup";
import ReinitializationProgress from "./components/ReinitializationProgress";
import { useActorReinitializer } from "./hooks/useActorReinitializer";
import { useActorWithInit } from "./hooks/useActorWithInit";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import { useGetCallerUserProfile } from "./hooks/useQueries";
import Dashboard from "./pages/Dashboard";
import LandingPage from "./pages/LandingPage";

export default function App() {
  const { identity, isInitializing: identityInitializing } =
    useInternetIdentity();
  const {
    isInitialized: _actorInitialized,
    isInitializing: actorInitializing,
    error: actorError,
  } = useActorWithInit();
  const reinitializer = useActorReinitializer();
  const {
    data: userProfile,
    isLoading: profileLoading,
    isFetched: profileFetched,
  } = useGetCallerUserProfile();

  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [_isAppMounted, setIsAppMounted] = useState(false);

  const isAuthenticated = !!identity;

  useEffect(() => {
    if (!identityInitializing && !actorInitializing) {
      setIsAppMounted(true);
    }
  }, [identityInitializing, actorInitializing]);

  useEffect(() => {
    if (
      isAuthenticated &&
      !profileLoading &&
      profileFetched &&
      userProfile === null
    ) {
      setShowProfileSetup(true);
    } else {
      setShowProfileSetup(false);
    }
  }, [isAuthenticated, profileLoading, profileFetched, userProfile]);

  if (reinitializer.isReinitializing) {
    return (
      <>
        <CosmicBackground />
        <ParticleBackground />
        <ReinitializationProgress
          attempt={reinitializer.attempt}
          maxAttempts={3}
          currentGateway={reinitializer.currentGateway}
        />
      </>
    );
  }

  if (identityInitializing || (isAuthenticated && actorInitializing)) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          backgroundImage: "url('/assets/uploads/IMG_0509-1.webp')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes spinReverse {
            from { transform: translate(-50%, -50%) rotate(0deg); }
            to { transform: translate(-50%, -50%) rotate(-360deg); }
          }
        `}</style>

        {/* Glassmorphism card at bottom */}
        <div
          style={{
            position: "absolute",
            bottom: "28%",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "20px",
            padding: "22px 60px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            whiteSpace: "nowrap",
          }}
        >
          {/* Double ring loader */}
          <div
            style={{
              position: "relative",
              width: "140px",
              height: "140px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Outer ring — magenta dashed, spinning */}
            <div
              style={{
                width: "140px",
                height: "140px",
                borderRadius: "50%",
                border: "12px dashed #E600E6",
                filter: "drop-shadow(0 0 8px rgba(230,0,230,0.85))",
                animation: "spin 3s linear infinite",
                position: "absolute",
                top: 0,
                left: 0,
              }}
            />
            {/* Inner ring — cyan solid, spinning reverse */}
            <div
              style={{
                width: "104px",
                height: "104px",
                borderRadius: "50%",
                border: "10px solid #00E6E6",
                filter: "drop-shadow(0 0 8px rgba(0,230,230,0.85))",
                animation: "spinReverse 1.5s linear infinite",
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%,-50%)",
              }}
            />
          </div>

          {/* Loading text */}
          <p
            className="font-orbitron"
            style={{
              marginTop: "22px",
              color: "#FFFFFF",
              textShadow: "0 0 12px rgba(255,255,255,0.75)",
              letterSpacing: "4px",
              fontSize: "1.35rem",
              textTransform: "uppercase",
            }}
          >
            LOADING CYBERLAND METAVERSE
          </p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && actorError) {
    return (
      <>
        <CosmicBackground />
        <ParticleBackground />
        <ConfigValidator />
        <div className="min-h-screen flex items-center justify-center relative z-10 p-4">
          <div className="max-w-3xl mx-auto p-8 glassmorphism rounded-lg neon-border box-glow-gold">
            <div className="flex items-start space-x-4">
              <AlertTriangle className="w-12 h-12 text-red-500 flex-shrink-0 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-red-500 mb-4 tracking-wider font-orbitron">
                  ОШИБКА ПОДКЛЮЧЕНИЯ
                </h2>
                <p className="text-red-300 mb-4 leading-relaxed font-jetbrains">
                  Не удалось установить стабильное соединение с сетью Internet
                  Computer после множественных попыток повтора с таймаутом 120
                  секунд, экспоненциальной задержкой (25 попыток) и
                  автоматическим переключением шлюзов.
                </p>

                <div className="glassmorphism border border-red-500/30 rounded p-4 mb-4">
                  <p className="text-red-300 text-xs font-mono break-all font-jetbrains">
                    <strong>Детали ошибки:</strong> {String(actorError)}
                  </p>
                </div>

                <div className="space-y-3 mb-6">
                  <h3 className="text-red-100 font-bold text-sm font-orbitron">
                    ШАГИ ПО УСТРАНЕНИЮ НЕПОЛАДОК:
                  </h3>
                  <ul className="list-disc list-inside space-y-2 text-red-200 text-sm font-jetbrains">
                    <li>Проверьте стабильность вашего интернет-соединения</li>
                    <li>
                      Убедитесь, что VITE_DFX_NETWORK установлен на "ic" в файле
                      .env
                    </li>
                    <li>
                      Подтвердите правильность настройки всех ID канистр:
                      <ul className="list-circle list-inside ml-6 mt-1 space-y-1 text-xs">
                        <li>
                          VITE_LAND_CANISTER_ID (br5f7-7uaaa-aaaaa-qaaca-cai)
                        </li>
                        <li>
                          VITE_ASSET_CANISTER_ID (bd3sg-teaaa-aaaaa-qaaba-cai)
                        </li>
                        <li>
                          VITE_CYBER_TOKEN_CANISTER_ID
                          (w4q3i-7yaaa-aaaam-ab3oq-cai)
                        </li>
                        <li>
                          VITE_MARKETPLACE_CANISTER_ID
                          (be2us-64aaa-aaaaa-qaabq-cai)
                        </li>
                        <li>
                          VITE_GOVERNANCE_CANISTER_ID
                          (bkyz2-fmaaa-aaaaa-qaaaq-cai)
                        </li>
                      </ul>
                    </li>
                    <li>
                      Убедитесь, что канистры развернуты и работают в основной
                      сети IC
                    </li>
                    <li>
                      Попробуйте очистить кэш браузера и перезагрузить страницу
                    </li>
                    <li>
                      Проверьте доступность шлюзов: ic0.app, boundary.ic0.app,
                      icp-api.io
                    </li>
                  </ul>
                </div>

                <div className="glassmorphism p-4 rounded border border-red-500/30 mb-4">
                  <h3 className="text-red-100 font-bold mb-2 text-sm font-orbitron">
                    КОНФИГУРАЦИЯ СЕТИ:
                  </h3>
                  <div className="space-y-1 text-xs font-mono font-jetbrains">
                    <p className="text-red-200">
                      Сеть:{" "}
                      <span className="text-[#00ffff]">
                        {import.meta.env.VITE_DFX_NETWORK || "НЕ УСТАНОВЛЕНО"}
                      </span>
                    </p>
                    <p className="text-red-200">
                      Основной шлюз:{" "}
                      <span className="text-[#00ffff]">
                        https://ic0.app (официальный DFINITY)
                      </span>
                    </p>
                    <p className="text-red-200">
                      Резервные шлюзы:{" "}
                      <span className="text-[#00ffff]">
                        boundary.ic0.app, icp-api.io
                      </span>
                    </p>
                    <p className="text-red-200">
                      Таймаут:{" "}
                      <span className="text-[#00ffff]">120 секунд</span>
                    </p>
                    <p className="text-red-200">
                      Логика повтора:{" "}
                      <span className="text-[#00ffff]">
                        25 попыток с экспоненциальной задержкой
                      </span>
                    </p>
                    <p className="text-red-200">
                      Опрос данных:{" "}
                      <span className="text-[#00ffff]">
                        25 попыток с 4 проверками работоспособности
                      </span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="w-full px-6 py-3 btn-gradient-cyan text-black font-bold rounded-lg font-orbitron flex items-center justify-center space-x-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  <span>Повторить подключение</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <CosmicBackground />
        <ParticleBackground />
        <ConfigValidator />
        <LandingPage />
      </>
    );
  }

  return (
    <>
      <CosmicBackground />
      <ParticleBackground />
      <ConfigValidator />
      {showProfileSetup && <ProfileSetup />}
      {!showProfileSetup && <Dashboard />}
    </>
  );
}
