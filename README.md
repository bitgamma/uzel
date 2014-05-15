Uzel
====

Uzel is your home's control panel. It can be your HVAC, your alarm, your plant irrigation control system, your lighting system and even more. And all this on the same device!

Uzel is meant to run on small embedded computer systems. Currently, it is being tested on the [Raspberry Pi](http://raspberrypi.org) but, being a Node application, it should be portable on other system without much effort, if at all.

Technically Uzel is a node based application server and hub for [OSNP](https://github.com/briksoftware/osnp) networks. It can handle any OSNP-compatible device and host any number of virtual appliances written for it. It ships with a Device Manager and a Dashboard appliance, which allows you to monitor all connected devices.

Devices can be anything, including temperature sensors, HVAC, water pumps, humidity sensors, switches, lights, etc.
Appliances are express.js based web applications, hosted on Uzel, performing tasks like controlling the air conditioning, monitoring and irrigating plants, opening or locking doors etc.

Uzel takes care of discovering, pairing/unpairing devices and making them available to appliances. It provides an easy and mobile friendly web interface to administrate it.

The project is still at a quite early development stage, and some features are not yet implemented. It is however ready for adventorous testers and hobbyist who would like to create connected devices.

## Demo

-- TODO: Video here --

## Features

* Allows to automatize virtually every task in your home
* Can communicate with a wide range of devices through Connectors
* Can host any number of appliances to perform any desidered function with the connected devices
* Provides a responsive and simple web-based administration interface
* Cross-platform
* Open Source

## Architecture

Uzel has an extensible and plug-in based architecture. The main components are

* Device Manager: discovers and administrates all devices with the help of connector. Provides access to devices to the appliances.
* Appliance Manager: load and manages appliances. It also handles Uzel's administrative web interface.
* Connectors: connectors carry OSNP commands and responses to/from the actual devices. Each connector implements a different transport protocol. A connector can also interface with non-OSNP devices, if it converts commands and responses to the correct format. Uzel bundles an OSNP over IEEE 802.15.4 connector.
* Appliances: appliances coordinate and use connected devices to have them perform useful tasks. It could be something as simple as regularly sampling readings from a sensor, or something more complex like turning the air conditioning on when it is too hot. Uzel bundles a Dashboard, allowing to see the current reading of various sensors or the state of other devices.

Connectors and appliances can be added at any time, by simply copying them in the correct folder. More connectors and appliances will be bundled directly with Uzel as soon as they are ready.

## Installation

-- TBD --

## Compatible devices

[Gradusnik](https://github.com/briksoftware/gradusnik) - A OSNP over IEEE 802.15.4 based thermometer.




