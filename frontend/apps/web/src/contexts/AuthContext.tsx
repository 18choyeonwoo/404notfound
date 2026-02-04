import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { checkAuth, login as apiLogin, logout as apiLogout } from '../apis/auth';
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'; // 환경변수 확인

const MOCK_USER = {
    userId: 999,
    email: 'mock@cukee.com',
    nickname: '개발용',
};

interface User {
    userId: number;
    email: string;
    nickname: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    setAuthUser: (user: User) => void;
    updateNickname: (newNickname: string) => Promise<void>;
    withdraw: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const location = useLocation();

    useEffect(() => {
        const initAuth = async () => {
            const path = location.pathname;
            if (path.startsWith('/console') || path.startsWith('/admin')) {
                setIsLoading(false);
                return;
            }
            // [모드 1] 모킹 모드일 때
            if (USE_MOCK) {
                console.log("🛠️ [Mock Mode] 강제 로그인 처리됨");
                setUser(MOCK_USER); // 무조건 로그인 상태로 시작
                setIsLoading(false);
                return;
            }
            //[모드2] 실제 웹 모드일때
            try {
                const userData = await checkAuth();
                setUser(userData);
            } catch (error) {
                // 401 Unauthorized or other errors -> Not authenticated
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const login = async (email: string, password: string) => {
        // [1] Mock 모드면 API 호출 아예 안 함 (바로 성공 처리)
        if (USE_MOCK) {
            console.log(`🛠️ [Mock Mode] 로그인 성공 (입력값: ${email})`);
            setUser(MOCK_USER);
            return; // 여기서 함수 종료!
        }

        // [2] Real 모드면 여기서 API 호출
        // 에러가 나면 Login.tsx의 catch 블록으로 던져짐
        const userData = await apiLogin(email, password);
        setUser(userData);
    };
    // ✅ 추가: 이미 로그인 된 유저 정보(회원가입 직후 등)를 상태에 반영
    const setAuthUser = (userData: User) => {
        console.log("✅ [Auth] 사용자 상태 직접 업데이트 (회원가입 후)");
        setUser(userData);
    };

    // [신규] 닉네임 변경
    const updateNickname = async (newNickname: string) => {
        if (USE_MOCK) {
            if (user) setUser({ ...user, nickname: newNickname });
            return;
        }

        // 실제 API 호출 (apis/auth.ts에 updateProfile 추가 필요)
        const { updateProfile } = await import('../apis/auth');
        await updateProfile({ nickname: newNickname });

        // 상태 업데이트 (화면 즉시 반영 - 응답값 의존 X, 요청값 사용)
        setUser((prev) => prev ? { ...prev, nickname: newNickname } : null);
    };

    const logout = async () => {
        if (USE_MOCK) {
            console.log("[Mock Mode] 로그아웃");
            setUser(null);
            return;
        }
        try {
            await apiLogout();
        } catch (error) {
            console.error("Logout failed", error);
        } finally {
            setUser(null);
            // Optional: Redirect handling here or in component
        }
    };

    // [신규] 회원 탈퇴
    const withdraw = async (password: string) => {
        if (USE_MOCK) {
            console.log(`[Mock Mode] 회원 탈퇴 처리됨 (비밀번호: ${password})`);
            setUser(null);
            return;
        }

        // 1. API 호출 (비밀번호 전달)
        const { withdrawUser } = await import('../apis/auth');
        await withdrawUser(password);

        // 2. 로그아웃 처리 (로컬 상태 초기화)
        // 백엔드에서 이미 쿠키를 삭제했으므로 클라이언트 상태만 비우면 됨.
        // 안전을 위해 logout() 호출하여 확실히 처리
        await logout();
    };

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            isLoading,
            login,
            logout,
            setAuthUser,
            updateNickname,
            withdraw
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
