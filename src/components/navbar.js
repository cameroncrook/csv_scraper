import { Outlet, Link } from "react-router-dom";
import logo from "../assets/images/logo.png";

const NavBar = () => {
    return (
        <>
            <header className="layout-header">
                <img className="main-logo" src={logo} alt="Janium Logo" width="200" />
                <div className="nav">
                    <Link className="nav-item" to="/">Home</Link>
                    <Link className="nav-item" to="/scraper">Scraper</Link>
                </div>
            </header>

            <Outlet />
        </>
    )
}

export default NavBar;