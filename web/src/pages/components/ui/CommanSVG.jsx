export const ShieldIcon = ({ width = 40, height = 40 }) => (
    <svg
        width={width}
        height={height}
        viewBox="0 0 96 96"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M16 18 C26 18 34 10 48 10 C62 10 70 18 80 18 V44 C80 61 68 75 48 86 C28 75 16 61 16 44 Z"
            fill="#FFC61A"
        />
        <path
            d="M24 26 C32 26 38 20 48 20 C58 20 64 26 72 26 V43 C72 57 62 68 48 77 C34 68 24 57 24 43 Z"
            fill="#F5C400"
        />
    </svg>
);

export const MegaphoneIcon = ({ width = 40, height = 40 }) => (
    <svg
        width={width}
        height={height}
        viewBox="0 0 96 96"
        xmlns="http://www.w3.org/2000/svg"
    >
        <rect x="36" y="62" width="18" height="8" rx="3" transform="rotate(20 36 62)" fill="#0B9CFF" />
        <rect x="8" y="28" width="6" height="28" rx="2" fill="#0B9CFF" />
        <path d="M14 30 L78 10 V62 L14 48 Z" fill="#1877C9" />
        <rect x="78" y="8" width="8" height="56" rx="1" fill="#36B3FF" />
    </svg>
);

export const CameraIcon = ({ width = 40, height = 40 }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 96 96"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Camera Body */}
    <rect
      x="10"
      y="24"
      width="76"
      height="52"
      rx="4"
      fill="#757D87"
    />

    {/* Bottom Shadow */}
    <rect
      x="10"
      y="72"
      width="76"
      height="4"
      fill="#4F555C"
    />

    {/* Top Bump */}
    <path
      d="M34 24
         L40 16
         H56
         L62 24
         Z"
      fill="#757D87"
    />

    {/* Blue Button */}
    <rect
      x="18"
      y="18"
      width="10"
      height="6"
      rx="2"
      fill="#1E88E5"
    />

    {/* Lens Outer Ring */}
    <circle
      cx="48"
      cy="48"
      r="17"
      fill="#FFFFFF"
    />

    {/* Lens */}
    <defs>
      <radialGradient id="lensGradient" cx="35%" cy="35%">
        <stop offset="0%" stopColor="#B784F6" />
        <stop offset="100%" stopColor="#3DA5F5" />
      </radialGradient>
    </defs>

    <circle
      cx="48"
      cy="48"
      r="12"
      fill="url(#lensGradient)"
    />

    {/* Flash */}
    <circle
      cx="71"
      cy="33"
      r="3"
      fill="#ECEFF1"
    />
  </svg>
);