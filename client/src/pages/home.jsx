import { Link } from "react-router-dom";
import UserProfileBadge from "../components/userprofilebadge"
import {FaChessPawn, FaClock, FaHistory} from 'react-icons/fa'
import { useContext } from "react";
import AuthContext from '../components/AuthContext'
const HomePage = () =>{
  console.log("inside home")
  const {userInfo} = useContext(AuthContext)
    const homeItems = [
        { to: '/play', icon: <FaClock />, label: 'Play' },
        // Add more if needed
      ];
    return(<div className="flex flex-col gap-4 items-center">
        <UserProfileBadge username={userInfo.username}/>
        <div className="flex justify-between w-fit gap-4">
            <div className="flex flex-col gap-5 items-stretch justify-center">
               {homeItems.map(({to, icon, label})=>(
                <Link
                key={to}
                to={to}
                className="flex items-center gap-4 px-4 py-3 text-black bg-blue-50 rounded-xl hover:bg-blue-100 hover:text-black transition-colors group"
              >
                <span className="text-xl text-blue-500 group-hover:text-blue-700">
                  {icon}
                </span>
                <span className="text-md font-medium">{label}</span>
              </Link>
               ))}
            </div>
            <img src="/chessboard.jpg" alt="" className="w-96 h-96"/>
        </div>
    </div>)
} 
export default HomePage