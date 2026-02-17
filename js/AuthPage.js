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
    const [formData, setFormData] = useState({
      name: "",
      email: "",
      password: "",
      university: "",
    });

    const handleChange = (e) => {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);

      // Basic validation
      if (!formData.email || !formData.password) {
        alert("Please fill in all fields.");
        setLoading(false);
        return;
      }

      if (isLogin) {
        const res = await onLogin(formData);
        if (!res.ok) alert(res.message || "Login failed");
      } else {
        if (!formData.name) {
          alert("Name is required");
          setLoading(false);
          return;
        }
        await onRegister(formData);
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

          {/* Small title (kept minimal to match the reference design) */}
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

          {/* Login / Register toggle aligned left */}
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
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Full name
                  </label>
                  <input
                    name="name"
                    type="text"
                    placeholder="Your name"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 bg-white"
                    value={formData.name}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    University / organization
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
              <input
                name="password"
                type="password"
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 bg-white"
                value={formData.password}
                onChange={handleChange}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full px-4 py-2.5 rounded-xl grad-btn text-white text-sm font-semibold shadow-card disabled:opacity-70 disabled:cursor-not-allowed"
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
