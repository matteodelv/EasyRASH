# EasyRASH
EasyRASH is a web application that allows people to create and manage events and conferences and the process of __peer review__ behind every proposed article. The main difference between other tools is that EasyRASH supports articles written in [RASH](https://github.com/essepuntato/rash/) (*Research Article in Simplified HTML*), which is a simpler and reduced version of HTML5 introduced by __University of Bologna__, to allow paper writing using just HTML.  
Group project for Web Technologies class 2015/16 UniBo.

### AUTHORS
__Matteo Del Vecchio  
Filippo Vigani__

### INSTALLATION & USAGE
We seized the occasion of this project and decided to try to learn new technologies, in fact, EasyRASH is based on __[Node.js](https://nodejs.org/en/)__. We deployed the project using `Node.js v6.7.0` and `npm v3.10.3`, so you need at least these versions to run EasyRASH (greater versions should be fine).  

1. Clone this repository in a folder of your choice
2. `$ cd your_folder/EasyRASH`
3. `$ npm install` (add `-g` flag to install dependencies globally)
4. Wait `npm` to install all the required dependencies

Once finished, you can issue the following command to start the application and reach it through a browser:
	
	$ node app.js
  
__NB:__ You have to be in the EasyRASH folder before issuing this command  
__NB:__ *IP address* and *port* used by the web application can be changed in `app.js` file, inside `app.listen()`  
__NB:__ *Users email verification service* has to be set up accordingly to your email settings. To do that, please edit `nodemailer.createTransport()` located in `api/authentication.js`

### COPYRIGHT
Our project is released under MIT license (please refear to LICENSE).  
Copyright on example papers provided to create EasyRASH belongs to their respective authors.