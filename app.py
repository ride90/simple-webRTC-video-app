#!/usr/bin/env python
# -*- coding: utf-8 -*-
import logging
import os
import uuid

from tornado.ioloop import IOLoop
from tornado.web import Application, RequestHandler
from tornado.websocket import WebSocketHandler

import settings


# logger
logger = logging.getLogger('webrtc_server')
logger.setLevel(logging.INFO)
fh = logging.FileHandler('webrtc_server.log')
fh.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s || %(message)s')
fh.setFormatter(formatter)
logger.addHandler(fh)

resolve = lambda *dirname: os.path.abspath(os.path.join(settings.ROOT_PATH, *dirname))

GLOBAL_NODES = {}


class IndexHandler(RequestHandler):
    def get(self):
        node = str(uuid.uuid4().get_hex().upper()[0:6])
        self.redirect('/node/' + node)


class NodeHandler(RequestHandler):
    def get(self, slug):
        self.render('node.html',
                    current_node=slug,
                    nodes=[n.name for n in GLOBAL_NODES.values() if n.name != slug])


class Node(object):
    def __init__(self, name, clients=[]):
        self.name = name
        self.clients = clients

    def __repr__(self):
        return "Node '{0}'".format(self.name)


class WebSocket(WebSocketHandler):

    def __init__(self, *args, **kwargs):
        super(WebSocket, self).__init__(*args, **kwargs)
        self.current_node = None

    def open(self, slug):
        logger.info('WebSocket opening "{0}" from %s'.format(slug), self.request.remote_ip)

        if slug not in GLOBAL_NODES:
            GLOBAL_NODES[slug] = Node(slug, [self])
        else:
            GLOBAL_NODES[slug].clients.append(self)

        self.current_node = GLOBAL_NODES[slug]

        if len(self.current_node.clients) == 1:
            self.write_message('owner')
        elif len(self.current_node.clients) > 2:
            self.write_message('magic_overload')
        else:
            self.write_message('guest')

        logger.info('WebSocket opened "{0}" from %s'.format(slug), self.request.remote_ip)

    def on_message(self, message):
        logger.info('Received message from %s: %s', self.request.remote_ip, message)

        for client in self.current_node.clients:
            if client is self:
                continue
            client.write_message(message)

    def on_close(self):
        logger.info('WebSocket connection closed.')
        self.current_node.clients.remove(self)


def main():
    app_settings = {'template_path': resolve('templates'),
                    'static_path': resolve('static'),
                    'debug': True}

    application = Application([(r'/', IndexHandler),
                               (r"/node/([^/]*)", NodeHandler),
                               (r'/wbsckt/([^/]*)', WebSocket)],
                              **app_settings)

    application.listen(address=settings.ADDRESS, port=settings.PORT)
    logger.info("Server started. Listen {host}:{port}.".format(host=settings.ADDRESS,
                                                               port=settings.PORT))
    # run reactor
    IOLoop.instance().start()


if __name__ == '__main__':
    main()
