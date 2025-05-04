import { useContext } from "react"
import api from "./api"

const fetchUserInfo=async(AuthContext)=>{
    const {setAuth, setLoading, setUser} = useContext(AuthContext)
    try{
        const user=await api.get('auth/get_user_info').data.user
        setUser(user)
        setAuth(true)
        setLoading(false)
    }catch(error){
        console.log('Error while fetching user information')
        setAuth(false)
        setLoading(false)
    }
}
export default fetchUserInfo