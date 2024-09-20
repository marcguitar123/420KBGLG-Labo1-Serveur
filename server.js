//Marc-Antoine Bouchard Groupe:02

import { createServer } from 'http';
import fs from 'fs';

function allowAllAnonymousAccess(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', '*');
}
function accessControlConfig(req, res) {
    if (req.headers['sec-fetch-mode'] == 'cors') { //La vérification des origines (Quand on a la propriété cors)
        allowAllAnonymousAccess(res);
        console.log("Client browser CORS check request");
    }
}
function CORS_Preflight(req, res) { //Si on veut écrire
    if (req.method === 'OPTIONS') {
        res.end();
        console.log("Client browser CORS preflight check request");
        return true;
    }
    return false;
}
function extract_Id_From_Request(req) { //Permet d'obtenir le id de la requête
    // .../api/ressources/id
    let parts = req.url.split('/');
    return parseInt(parts[parts.length - 1]);
}
//La fonction validateBookmark permet de vérifier si le contenu du nouveau favori est correct ou s'il manque des propriétés.
function validateBookmark(bookmark) { 
    if (!('Title' in bookmark)) return 'Title is missing';
    if (!('Url' in bookmark)) return 'Url is missing';
    if (!('Category' in bookmark)) return 'Category is missing';
    return '';
}

function validateContact(contact) { //Permet de vérifier le contenu du nouveau contact (propriété).
    if (!('Name' in contact)) return 'Name is missing';
    if (!('Phone' in contact)) return 'Phone is missing';
    if (!('Email' in contact)) return 'Email is missing';
    return '';
}

//Gestionnaire des requêtes pour le service bookmark
async function handleBookmarksServiceRequest(req, res) {
    if (req.url.includes("/api/bookmarks")) {
        const BookmarksFilePath = "./bookmarks.json";
        let bookmarksJSON = fs.readFileSync(BookmarksFilePath);
        let bookmarks = JSON.parse(bookmarksJSON);
        let validStatus = '';
        let id = extract_Id_From_Request(req);
        switch (req.method) {
            case 'GET':
                if (isNaN(id)) {
                    res.writeHead(200, { 'content-type': 'application/json' });
                    res.end(bookmarksJSON); //On donne les favoris en string puisqu'on ne peut donner les favoris en objet javascript, comme réponse à la requête
                } else {
                    let found = false;
                    for (let bookmark of bookmarks) {
                        if (bookmark.Id === id) {
                            found = true;
                            res.writeHead(200, { 'content-type': 'application/json' });
                            res.end(JSON.stringify(bookmark)); //Converti en string, l'objet JavaScript bookmark et retourne le tout dans la réponse de la requête
                            break;
                        }
                    }
                    if (!found) {
                        res.writeHead(404);
                        res.end(`Error : The bookmark of id ${id} does not exist`);
                    }
                }
                break;
            case 'POST':
                let newBookmark = await getPayload(req);
                validStatus = validateBookmark(newBookmark);
                if (validStatus == '') { //Lorsque nous avons pas toutes les propriétés requises, dans le body de la requête
                    let maxId = 0;
                    bookmarks.forEach(bookmark => {
                        if (bookmark.Id > maxId)
                            maxId = bookmark.Id;
                    });
                    newBookmark.Id = maxId + 1;
                    newBookmark.Category = newBookmark.Category.toLowerCase();
                    bookmarks.push(newBookmark);
                    fs.writeFileSync(BookmarksFilePath, JSON.stringify(bookmarks));
                    res.writeHead(201, { 'content-type': 'application/json' });
                    res.end(JSON.stringify(newBookmark));
                } else { //Erreur lorsque nous n'avons pas toutes les propriétés requises, dans le body de la requête
                    res.writeHead(400);
                    res.end(`Error: ${validStatus}`);
                }
                break;
            case 'PUT':
                let modifiedBookmark = await getPayload(req);
                validStatus = validateBookmark(modifiedBookmark);
                if (validStatus == '') {
                    if (!isNaN(id)) {
                        if (!('Id' in modifiedBookmark)) modifiedBookmark.Id = id;
                        if (modifiedBookmark.Id == id) { //Vérifier si le Id de l'url et le Id du body sont égaux.
                            let storedBookmark = null;
                            for (let bookmark of bookmarks) {
                                if (bookmark.Id === id) {
                                    storedBookmark = bookmark;
                                    break;
                                }
                            }
                            if (storedBookmark != null) { //Vérifier si on a trouvé le favori ayant le id spécifié dans la requête.
                                storedBookmark.Title = modifiedBookmark.Title;
                                storedBookmark.Url = modifiedBookmark.Url;
                                storedBookmark.Category = modifiedBookmark.Category.toLowerCase();
                                fs.writeFileSync(BookmarksFilePath, JSON.stringify(bookmarks));
                                res.writeHead(200);
                                res.end();
                            } else { //Si on a pas trouvé le favori ayant le id spécifié dans la requête
                                res.writeHead(404);
                                res.end(`Error: The bookmark of id ${id} does not exist.`);
                            }
                        } else { //Si le id de l'url et le id du body ne sont pas égaux. 
                            res.writeHead(409);
                            res.end(`Error: Conflict of id`);
                        }
                    } else { //Si le dernier élément de la requête n'est pas un id (int)
                        res.writeHead(400);
                        res.end("Error : You must provide the id of bookmark to modify.");
                    }
                } else { //Erreur lorsque nous n'avons pas toutes les propriétés requises, dans le body de la requête
                    res.writeHead(400);
                    res.end(`Error: ${validStatus}`);
                }
                break;
            case 'DELETE':
                if (!isNaN(id)) { //Vérifier si un id est fourni dans la requête
                    let index = 0;
                    let oneDeleted = false;
                    for (let bookmark of bookmarks) {
                        if (bookmark.Id === id) {
                            bookmarks.splice(index, 1);
                            fs.writeFileSync(BookmarksFilePath, JSON.stringify(bookmarks));
                            oneDeleted = true;
                            break;
                        }
                        index++;
                    }
                    if (oneDeleted) { //Vérifier si un favori a été supprimé
                        res.writeHead(204); // success no content
                        res.end();
                    } else { //Aucun favori ayant le id spécifié dans la requête n'a été trouvé.
                        res.writeHead(404);
                        res.end(`Error: The bookmark of id ${id} does not exist.`);
                    }
                } else { //Si aucun id est fourni dans la requête
                    res.writeHead(400);
                    res.end("Error : You must provide the id of bookmark to delete.");
                }
                break;
            case 'PATCH':
                res.writeHead(501);
                res.end("Error: The endpoint PATCH api/bookmarks is not implemented.");
                break;
        }
        return true;
    }
    return false;
}
//Gestionnaire des requêtes pour le service contact
async function handleContactsServiceRequest(req, res) {
    if (req.url.includes("/api/contacts")) {
        const contactsFilePath = "./contacts.json";
        let contactsJSON = fs.readFileSync(contactsFilePath);
        let contacts = JSON.parse(contactsJSON);
        let validStatus = '';
        let id = extract_Id_From_Request(req);
        switch (req.method) {
            case 'GET':
                if (isNaN(id)) {
                    res.writeHead(200, { 'content-type': 'application/json' });
                    res.end(contactsJSON);
                } else {
                    let found = false;
                    for (let contact of contacts) {
                        if (contact.Id === id) {
                            found = true;
                            res.writeHead(200, { 'content-type': 'application/json' });
                            res.end(JSON.stringify(contact));
                            break;
                        }
                    }
                    if (!found) {
                        res.writeHead(404);
                        res.end(`Error : The contact of id ${id} does not exist`);
                    }
                }
                break;
            case 'POST':
                let newContact = await getPayload(req);
                validStatus = validateContact(newContact);
                if (validStatus == '') {
                    let maxId = 0;
                    contacts.forEach(contact => {
                        if (contact.Id > maxId)
                            maxId = contact.Id;
                    });
                    newContact.Id = maxId + 1;
                    contacts.push(newContact);
                    fs.writeFileSync(contactsFilePath, JSON.stringify(contacts));
                    res.writeHead(201, { 'content-type': 'application/json' });
                    res.end(JSON.stringify(newContact));
                } else {
                    res.writeHead(400);
                    res.end(`Error: ${validStatus}`);
                }
                break;
            case 'PUT':
                let modifiedContact = await getPayload(req);
                validStatus = validateContact(modifiedContact);
                if (validStatus == '') {
                    if (!isNaN(id)) {
                        if (!('Id' in modifiedContact)) modifiedContact.Id = id;
                        if (modifiedContact.Id == id) { //Vérifier si le Id de l'url et la le Id du body sont égaux.
                            let storedContact = null;
                            for (let contact of contacts) {
                                if (contact.Id === id) {
                                    storedContact = contact;
                                    break;
                                }
                            }
                            if (storedContact != null) {
                                storedContact.Name = modifiedContact.Name;
                                storedContact.Phone = modifiedContact.Phone;
                                storedContact.Email = modifiedContact.Email;
                                fs.writeFileSync(contactsFilePath, JSON.stringify(contacts));
                                res.writeHead(200);
                                res.end();
                            } else {
                                res.writeHead(404);
                                res.end(`Error: The contact of id ${id} does not exist.`);
                            }
                        } else {
                            res.writeHead(409);
                            res.end(`Error: Conflict of id`);
                        }
                    } else {
                        res.writeHead(400);
                        res.end("Error : You must provide the id of contact to modify.");
                    }
                } else {
                    res.writeHead(400);
                    res.end(`Error: ${validStatus}`);
                }
                break;
            case 'DELETE':
                if (!isNaN(id)) {
                    let index = 0;
                    let oneDeleted = false;
                    for (let contact of contacts) {
                        if (contact.Id === id) {
                            contacts.splice(index, 1);
                            fs.writeFileSync(contactsFilePath, JSON.stringify(contacts));
                            oneDeleted = true;
                            break;
                        }
                        index++;
                    }
                    if (oneDeleted) {
                        res.writeHead(204); // success no content
                        res.end();
                    } else {
                        res.writeHead(404);
                        res.end(`Error: The contact of id ${id} does not exist.`);
                    }
                } else {
                    res.writeHead(400);
                    res.end("Error : You must provide the id of contact to delete.");
                }
                break;
            case 'PATCH':
                res.writeHead(501);
                res.end("Error: The endpoint PATCH api/contacts is not implemented.");
                break;
        }
        return true;
    }
    return false;
}

async function handleRequest(req, res) {
    if (! await handleContactsServiceRequest(req, res))
        if (! await handleBookmarksServiceRequest(req, res))
            return false;
    return true;
}

function getPayload(req) {
    return new Promise(resolve => {
        let body = [];
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            if (body.length > 0)
                if (req.headers['content-type'] == "application/json")
                    try { resolve(JSON.parse(body)); }
                    catch (error) { console.log(error); }
            resolve(null);
        });
    })
}

const server = createServer(async (req, res) => {
    console.log(req.method, req.url);
    accessControlConfig(req, res);
    if (!CORS_Preflight(req, res))
        if (!await handleRequest(req, res)) {
            res.writeHead(404);
            res.end();
        }
});
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));