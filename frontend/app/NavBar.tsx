export default function NavBar() {
    return (
      <nav className="fixed top-0 left-0 w-full z-50 pl-12 pr-12 py-6 grid grid-cols-3 items-center">

        <div className="grid grid-cols-4
                        gap-[50px]
                        font-inter font-light
                        tracking-[0.03em] 
                        text-white uppercase
                        m-auto">  {/* m-auto is used to center the navbar */}
            <a href="#" className="hover:opacity-10 transition-opacity">Watches</a>
            <a href="#" className="hover:opacity-10 transition-opacity">Trend</a>
            <a href="#" className="hover:opacity-10 transition-opacity">Stories</a>
            <a href="#" className="hover:opacity-10 transition-opacity">Contact</a>
        </div>
        <h1 className=" font-playfair 
                        text-[48px]  
                        tourbillon-text-color  
                        justify-self-center
                        opacity-90
                        hover:opacity-10 transition-opacity"
            style={{fontWeight: 300}}>
            {/* font-weight-300 hardcoded because the font-weight-300 is not available in playfair display */}
            Tourbillon
        </h1>
        <div className="flex gap-4 text-white">
          {/* Icons */}
        </div>
      </nav>
    );
  }
  