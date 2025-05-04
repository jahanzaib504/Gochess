import {FaChessPawn, FaFlagCheckered} from 'react-icons/fa'
const UserProfileBadge = ({username="", profilePicture="/profilepic.svg", countryFlag="/flag.svg"}) =>{
    return (<div className="flex gap-2 items-center p-4 justify-center w-fit rounded-lg">
        <img src={profilePicture } alt="" className='w-10 h-10'/>
        <div className='text-2xl font-semibold'>{username}</div>
        <img src={countryFlag} alt="" className='w-5 h-5'/>
    </div>)
}
export default UserProfileBadge;