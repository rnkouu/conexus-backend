// js/AuthPage.js
(function () {
  // ✅ Check React
  if (!window.React || !window.React.useState) {
    console.error("AuthPage: React not found");
    return;
  }
  const { useState } = window.React;

  // tiny helper (design-only)
  function classNames() {
    return Array.prototype.slice.call(arguments).filter(Boolean).join(" ");
  }

  function AuthPage({ onBack, onLogin, onRegister }) {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    
    const [formData, setFormData] = useState({
      firstName: "",
      middleInitial: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "", 
      university: "",
      gender: "", // <-- ADDED: State for gender
    });

    const handleChange = (e) => {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);

      if (!formData.email || !formData.password) {
        window.Swal.fire({ title: 'Missing Fields', text: 'Please fill in email and password.', icon: 'warning', confirmButtonColor: '#1e5aa8' });
        setLoading(false);
        return;
      }

      if (isLogin) {
        const res = await onLogin({ email: formData.email, password: formData.password });
        if (!res.ok) {
            window.Swal.fire({ title: 'Login Failed', text: res.message || "Invalid credentials", icon: 'error', confirmButtonColor: '#1e5aa8' });
        }
      } else {
        if (!formData.firstName || !formData.lastName || !formData.gender) {
          window.Swal.fire({ title: 'Missing Fields', text: 'First Name, Last Name, and Gender are required', icon: 'warning', confirmButtonColor: '#1e5aa8' });
          setLoading(false);
          return;
        }

        if (formData.password !== formData.confirmPassword) {
          window.Swal.fire({ title: 'Password Mismatch', text: 'Passwords do not match.', icon: 'warning', confirmButtonColor: '#1e5aa8' });
          setLoading(false);
          return;
        }

        const mi = formData.middleInitial ? `${formData.middleInitial.toUpperCase()}.` : "";
        const fullName = `${formData.firstName} ${mi} ${formData.lastName}`.replace(/\s+/g, " ").trim();

        await onRegister({
            name: fullName,
            email: formData.email,
            password: formData.password,
            university: formData.university,
            gender: formData.gender // <-- ADDED: Sending gender to backend
        });
      }
      setLoading(false);
    };

    return (
      <section className="relative px-4 py-12 max-w-7xl mx-auto flex items-center justify-center min-h-[70vh]">
        <div className="relative w-full max-w-md hover-card rounded-2xl bg-white/95 border border-gray-100 shadow-card px-6 py-7 sm:px-8 sm:py-8">
          {/* Back button */}
          <button
            type="button"
            onClick={onBack}
            className="mb-4 text-xs text-gray-500 hover:text-accent1 inline-flex items-center gap-1"
          >
            <span>←</span>
            <span>Back to landing</span>
          </button>

          {/* Title */}
          <div className="mb-4">
            <div className="text-base sm:text-lg font-semibold text-gray-900">
              {isLogin ? "Welcome back" : "Create your account"}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {isLogin
                ? "Sign in to continue."
                : "Register to join and access events."}
            </div>
          </div>

          {/* Login / Register toggle */}
          <div className="flex items-center justify-start mb-4">
            <div className="inline-flex rounded-full bg-soft border border-gray-200 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className={classNames(
                  "px-3 py-1.5 rounded-full",
                  isLogin
                    ? "bg-white shadow-sm text-brand"
                    : "text-gray-500 hover:text-gray-800"
                )}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className={classNames(
                  "px-3 py-1.5 rounded-full",
                  !isLogin
                    ? "bg-white shadow-sm text-brand"
                    : "text-gray-500 hover:text-gray-800"
                )}
              >
                Register
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3 text-sm">
            {!isLogin && (
              <>
                <div className="flex gap-3">
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                            First Name
                        </label>
                        <input
                            name="firstName"
                            type="text"
                            placeholder="Juan"
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 bg-white"
                            value={formData.firstName}
                            onChange={handleChange}
                        />
                    </div>
                    <div className="w-16">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                            M.I.
                        </label>
                        <input
                            name="middleInitial"
                            type="text"
                            placeholder="D"
                            maxLength={1}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 bg-white text-center uppercase"
                            value={formData.middleInitial}
                            onChange={handleChange}
                        />
                    </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Last Name
                  </label>
                  <input
                    name="lastName"
                    type="text"
                    placeholder="Dela Cruz"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 bg-white"
                    value={formData.lastName}
                    onChange={handleChange}
                  />
                </div>

                {/* --- ADDED GENDER FIELD --- */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
                  <select
                    name="gender"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 bg-white"
                    value={formData.gender}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    University / Organization
                  </label>
                  <input
                    name="university"
                    type="text"
                    placeholder="Your school or institution"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 bg-white"
                    value={formData.university}
                    onChange={handleChange}
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Email
              </label>
              <input
                name="email"
                type="email"
                placeholder="you@example.com"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 bg-white"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-gray-200 pl-3 pr-10 py-2 bg-white"
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  )}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-gray-200 pl-3 pr-10 py-2 bg-white"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showConfirmPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full px-4 py-2.5 rounded-xl grad-btn text-white text-sm font-semibold shadow-card disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading
                ? "Processing…"
                : isLogin
                ? "Login"
                : "Create account"}
            </button>
          </form>
        </div>
      </section>
    );
  }

  // Expose component globally
  window.AuthPage = AuthPage;
})();