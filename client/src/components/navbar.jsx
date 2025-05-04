import { Link } from 'react-router-dom';
import { FaHome, FaClock, FaRegComment } from 'react-icons/fa';
import { RiBarChartHorizontalLine } from 'react-icons/ri';

const NavBar = () => {
  const navItems = [
    { to: '/home', icon: <FaHome />, label: 'Home' },
    { to: '/play', icon: <FaClock />, label: 'Play' },
    // Add more if needed
  ];

  return (
    <nav className="flex flex-col fixed top-0 left-0 h-screen p-4 bg-white shadow-lg border-r w-64">
      {/* Logo */}
      <div className="flex items-center justify-center mb-10">
        <img src="/logo.svg" alt="Logo" className="w-16 h-16 rounded-full bg-white" />
      </div>

      {/* Navigation Links */}
      <div className="flex flex-col gap-2">
        {navItems.map(({ to, icon, label }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-4 px-4 py-3 text-black rounded-xl hover:bg-blue-100 transition-colors group"
          >
            <span className="text-xl text-blue-500 group-hover:text-blue-700">
              {icon}
            </span>
            <span className="text-md font-medium">{label}</span>
          </Link>
        ))}
      </div>

      {/* Bottom Icon (e.g., Chart or Settings) */}
      <div className="mt-auto">
        <Link
          to="/analytics"
          className="flex items-center gap-4 px-4 py-3 text-gray-700 rounded-xl hover:bg-blue-100 transition-colors group"
        >
          <span className="text-xl text-blue-500 group-hover:text-blue-700">
            <RiBarChartHorizontalLine />
          </span>
          <span className="text-md font-medium">Analytics</span>
        </Link>
      </div>
    </nav>
  );
};

export default NavBar;
